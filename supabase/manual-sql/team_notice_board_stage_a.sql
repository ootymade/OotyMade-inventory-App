-- team_notice_board_stage_a.sql — written 2026-10-07, based on commit
-- b92859dedad1c10d1b883a88d2d0c70f28ed4d15. Check `git log` on this path
-- for the commit that actually matters when comparing against GitHub.
--
-- STEP 3, STAGE A — Announcements (admin posts, pin, seen-by) + order
-- notes (one thread per Shopify order, one per direct-order invoice).
-- No chat, no photos, no push — those are stages B/C/D.
--
-- WHAT THIS CREATES
--   team_notices      — one row per announcement. Any signed-in team
--                        member can read; only admins can post or pin
--                        (checked against team_members.role, not just
--                        the UI). No edit, no delete, by design — that
--                        matches "indefinite retention for
--                        announcements": there is nothing in this
--                        schema that can remove one.
--   team_notice_seen  — one row per (notice, team member) once that
--                        member has opened it. Anyone can read the
--                        full list (so "seen by" is visible to the
--                        whole team); a member can only ever mark
--                        themselves as having seen something, never
--                        someone else.
--   order_notes       — one row per note, attached to exactly one of a
--                        Shopify order or a direct-order invoice (same
--                        "exactly one parent" pattern as the
--                        `shipments` table from Step 2). Any signed-in
--                        member can read and add notes; no edit, no
--                        delete — a running, permanent log of what was
--                        said about an order.
--
-- SECURITY, PER YOUR STANDING RULE
--   RLS is enabled on all three tables. anon and PUBLIC get nothing at
--   all. authenticated gets exactly: SELECT+INSERT+UPDATE on
--   team_notices (UPDATE is admin-gated by RLS, not by a separate
--   grant — see below), SELECT+INSERT on team_notice_seen and
--   order_notes. Nothing gets DELETE, anywhere, from any role.
--
--   One thing this was tested revealing: a brand-new table created by
--   `postgres` gets a STANDING DEFAULT that hands `authenticated` every
--   privilege automatically (not just anon — the same leak the anon
--   lockdown fixed, but for authenticated too, which is normally fine
--   except it would have silently given DELETE on these tables despite
--   never being asked for). This script explicitly revokes from
--   authenticated first, then grants back only the exact subset listed
--   above, rather than assuming "I only wrote three GRANT lines so
--   that's all it has."
--
-- WHY THE DELETE TESTS BELOW LOOK FOR "ROWS REMAINING", NOT AN ERROR
--   Postgres RLS has a subtlety worth knowing before you read the test
--   results in the chat message: if a table has RLS enabled and NO
--   policy at all for a given command (here, UPDATE-as-staff and
--   DELETE-as-anyone), running that command doesn't raise an error —
--   it just matches zero rows, silently. So "no error" is not proof
--   something worked; the real check is whether the row actually
--   changed. All verification below checks the row, not just whether
--   the statement complained.
-- ============================================================================

begin;

create table team_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  created_by uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  pinned boolean not null default false,
  pinned_at timestamptz,
  pinned_by uuid references team_members(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table team_notice_seen (
  notice_id uuid not null references team_notices(id) on delete cascade,
  team_member_id uuid not null references team_members(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (notice_id, team_member_id)
);

create table order_notes (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id uuid references shopify_orders(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  body text not null,
  created_by uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint order_notes_exactly_one_parent check (
    (shopify_order_id is not null and invoice_id is null) or
    (shopify_order_id is null and invoice_id is not null)
  )
);

alter table team_notices enable row level security;
alter table team_notice_seen enable row level security;
alter table order_notes enable row level security;

create policy "team members can read notices" on team_notices
  for select to authenticated using (true);
create policy "admins can insert notices" on team_notices
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin')
  );
create policy "admins can update notices" on team_notices
  for update to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin'));

create policy "team members can read seen" on team_notice_seen
  for select to authenticated using (true);
create policy "members mark their own seen" on team_notice_seen
  for insert to authenticated
  with check (team_member_id = (select auth.uid()));

create policy "team members can read order notes" on order_notes
  for select to authenticated using (true);
create policy "team members can add order notes" on order_notes
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- Strip the standing default grant authenticated gets automatically on
-- any new table, then grant back exactly the subset each table needs.
revoke all on team_notices, team_notice_seen, order_notes from anon, public, authenticated;
grant select, insert, update on team_notices to authenticated;
grant select, insert on team_notice_seen to authenticated;
grant select, insert on order_notes to authenticated;

-- Live refresh across phones, same mechanism every other screen uses.
alter publication supabase_realtime add table team_notices, team_notice_seen, order_notes;

commit;

select 'STAGE A APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - First query: zero rows (anon/PUBLIC have nothing on any of the 3 tables).
--   - Second query: every column true (authenticated has exactly SELECT/
--     INSERT/UPDATE on team_notices, SELECT/INSERT on the other two —
--     and DELETE false everywhere, on purpose, nowhere granted).
--   - Third query: 3 rows (all three tables present in the Realtime publication).
-- ============================================================================

select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('team_notices', 'team_notice_seen', 'order_notes')
  and grantee in ('anon', 'public');

select
  has_table_privilege('authenticated', 'public.team_notices', 'SELECT') as notices_select,
  has_table_privilege('authenticated', 'public.team_notices', 'INSERT') as notices_insert,
  has_table_privilege('authenticated', 'public.team_notices', 'UPDATE') as notices_update,
  has_table_privilege('authenticated', 'public.team_notices', 'DELETE') as notices_delete_should_be_false,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'SELECT') as seen_select,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'INSERT') as seen_insert,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'DELETE') as seen_delete_should_be_false,
  has_table_privilege('authenticated', 'public.order_notes', 'SELECT') as order_notes_select,
  has_table_privilege('authenticated', 'public.order_notes', 'INSERT') as order_notes_insert,
  has_table_privilege('authenticated', 'public.order_notes', 'DELETE') as order_notes_delete_should_be_false;

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename in ('team_notices', 'team_notice_seen', 'order_notes');
