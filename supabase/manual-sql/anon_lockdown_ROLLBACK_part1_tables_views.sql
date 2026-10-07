-- anon_lockdown_ROLLBACK_part1_tables_views.sql — rollback for
-- anon_lockdown_part1_tables_views.sql. Run only this part's rollback if
-- only part 1 was run and needs undoing — independent of the other
-- rollback parts.
--
-- Restores exactly what part 1 removed: anon held every table-level
-- privilege (SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE —
-- i.e. ALL) on each of these 9 tables. No table had a PUBLIC-pseudo-role
-- grant to restore.
-- ============================================================================

begin;

grant all privileges on table customers to anon;
grant all privileges on table daily_order_counts to anon;
grant all privileges on table invoice_items to anon;
grant all privileges on table invoices to anon;
grant all privileges on table movements to anon;
grant all privileges on table products to anon;
grant all privileges on table purchase_orders to anon;
grant all privileges on table suppliers to anon;
grant all privileges on table team_members to anon;

commit;

select 'ROLLBACK PART 1 APPLIED' as status;

-- Verification — expect every column true (matches pre-lockdown state).
select
  has_table_privilege('anon', 'public.customers', 'SELECT') as customers_select,
  has_table_privilege('anon', 'public.team_members', 'SELECT') as team_members_select;
