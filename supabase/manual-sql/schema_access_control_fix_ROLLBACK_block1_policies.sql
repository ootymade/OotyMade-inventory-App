-- ROLLBACK for block 1 — restores the previous (looser) policies.
-- Only run this if block 1 needs to be fully undone; it reopens the
-- gap the block closed. Paste into its own tab and Run.
begin;

alter policy "team full access" on customers to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on daily_order_counts to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on invoice_items to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on invoices to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on movements to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on products to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on purchase_orders to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');
alter policy "team full access" on suppliers to public
  using (( select auth.role()) = 'authenticated')
  with check (( select auth.role()) = 'authenticated');

alter policy "team members readable by any signed-in user" on team_members to public
  using (( select auth.role()) = 'authenticated');

alter policy "team members can read couriers" on couriers to authenticated
  using (true);
alter policy "team members can read shipments" on shipments to authenticated
  using (true);
alter policy "team members can read shopify_settings" on shopify_settings to authenticated
  using (true);
alter policy "ping readable" on shopify_sync_ping to public
  using (( select auth.role()) = 'authenticated');

revoke all on function public.is_team_member(uuid) from authenticated, public, anon;

commit;

select 'ROLLBACK BLOCK 1 APPLIED' as status;
