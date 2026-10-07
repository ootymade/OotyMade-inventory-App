-- BLOCK 1 of 3 — closes the gap found while testing Stage A: most of
-- the app's existing policies only checked "is this caller signed in"
-- (authenticated), not "is this caller actually one of our team
-- members." A stranger who created any Supabase account (not through
-- this app) could sign in and would have passed every one of these
-- checks. This block tightens every one of them to also require a
-- real team_members row. Paste this whole file into its own SQL
-- Editor tab and click Run.
--
-- No DROP statements are used — everything here is a plain
-- replace-in-place (ALTER POLICY / CREATE OR REPLACE), so there is
-- nothing to lose and nothing can be left half-dropped.
begin;

-- team_members' own "can I read the roster" policy can't check
-- membership by querying team_members from inside its own policy
-- (that's a self-reference Postgres won't evaluate safely), so this
-- uses a small helper function instead. The function runs with the
-- table owner's privileges, which is the standard, safe way to do
-- this self-check.
create or replace function public.is_team_member(p_uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from team_members where id = p_uid);
$$;
revoke all on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

alter policy "team full access" on customers to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on daily_order_counts to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on invoice_items to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on invoices to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on movements to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on products to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on purchase_orders to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team full access" on suppliers to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())))
  with check (exists (select 1 from team_members where id = (select auth.uid())));

alter policy "team members readable by any signed-in user" on team_members to authenticated
  using (is_team_member((select auth.uid())));

alter policy "team members can read couriers" on couriers to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team members can read shipments" on shipments to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "team members can read shopify_settings" on shopify_settings to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())));
alter policy "ping readable" on shopify_sync_ping to authenticated
  using (exists (select 1 from team_members where id = (select auth.uid())));

commit;

select 'BLOCK 1 APPLIED' as status;
