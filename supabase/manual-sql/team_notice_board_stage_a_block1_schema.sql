-- BLOCK 1 of 7 — creates the three Stage A tables, their security
-- policies, and grants. Paste this whole file into its own SQL Editor
-- tab and click Run.
--
-- team_notices      — announcements. Any signed-in member can read the
--                      non-hidden ones; admins can read hidden ones too.
--                      Posting, editing, pinning and hiding all go
--                      through admin-checked functions in block 4 —
--                      this block deliberately grants no direct way to
--                      change a row at all once inserted.
-- team_notice_seen  — one row per (notice, member) once opened.
-- order_notes       — one note thread per Shopify order or per
--                      direct-order invoice (exactly one, enforced by
--                      a constraint). Same hide behavior as notices,
--                      via block 4's functions.
begin;

create table team_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  created_by uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  pinned boolean not null default false,
  pinned_at timestamptz,
  pinned_by uuid references team_members(id) on delete set null,
  hidden_at timestamptz,
  hidden_by uuid references team_members(id) on delete set null,
  hidden_reason text,
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
  hidden_at timestamptz,
  hidden_by uuid references team_members(id) on delete set null,
  hidden_reason text,
  constraint order_notes_exactly_one_parent check (
    (shopify_order_id is not null and invoice_id is null) or
    (shopify_order_id is null and invoice_id is not null)
  )
);

alter table team_notices enable row level security;
alter table team_notice_seen enable row level security;
alter table order_notes enable row level security;

create policy "visible to staff, all to admins" on team_notices
  for select to authenticated
  using (hidden_at is null or exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin'));
create policy "admins post" on team_notices
  for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin'));

create policy "team members can read seen" on team_notice_seen
  for select to authenticated using (true);
create policy "members mark their own seen" on team_notice_seen
  for insert to authenticated
  with check (team_member_id = (select auth.uid()));

create policy "visible to staff, all to admins" on order_notes
  for select to authenticated
  using (hidden_at is null or exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin'));
create policy "members add notes" on order_notes
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- A new table created here gets a standing default that hands
-- authenticated every privilege automatically — revoke that first,
-- then grant back only what's needed. No UPDATE anywhere: pin/edit/
-- hide/unhide all go through the functions in block 4 instead.
revoke all on team_notices, team_notice_seen, order_notes from anon, public, authenticated;
grant select, insert on team_notices to authenticated;
grant select, insert on team_notice_seen to authenticated;
grant select, insert on order_notes to authenticated;

commit;

select 'BLOCK 1 APPLIED' as status;
