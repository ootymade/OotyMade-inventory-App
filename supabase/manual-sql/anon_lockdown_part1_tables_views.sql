-- anon_lockdown_part1_tables_views.sql — written 2026-10-07, based on commit
-- 1906dfcee0f9129f79a4941c4faac4c4b18e426d. If you're comparing against
-- GitHub, this file's own commit (check `git log` on this path) is the one
-- that matters — this line only records what it was built on top of.
--
-- PART 1 of 5 — TABLES AND VIEWS ONLY. Independently runnable: does not
-- need part 2, 3, 4 or 5 to have run first or after. Run this one alone
-- and the app keeps working exactly as before, just with anon/PUBLIC no
-- longer able to touch any of the 9 tables below at the grant level.
--
-- What it does: revokes every table-level privilege (SELECT, INSERT,
-- UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE) that `anon` or the
-- PUBLIC pseudo-role (= "every role") currently holds on any table or
-- view in the public schema. "ALL TABLES IN SCHEMA" covers views too.
--
-- Why safe: RLS already blocks anon from reading or writing any of
-- these 9 tables (customers, daily_order_counts, invoice_items,
-- invoices, movements, products, purchase_orders, suppliers,
-- team_members) — confirmed earlier by role simulation: every one
-- returns 0 rows to anon today, and an anon INSERT was rejected by RLS.
-- This closes the raw-grant gap RLS was covering for; it does not
-- change what currently works. `authenticated` is never named in this
-- statement, so its access is untouched regardless.
-- ============================================================================

begin;

revoke all privileges on all tables in schema public from anon, public;

commit;

select 'PART 1 APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - First query: zero rows (anon/PUBLIC own nothing at the table level).
--   - Second query: every column true (authenticated completely unaffected).
-- ============================================================================

select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'public');

select
  has_table_privilege('authenticated', 'public.customers', 'SELECT') as customers_select,
  has_table_privilege('authenticated', 'public.team_members', 'SELECT') as team_members_select,
  has_table_privilege('authenticated', 'public.couriers', 'SELECT') as couriers_select,
  has_table_privilege('authenticated', 'public.products', 'UPDATE') as products_update;

-- Real anon-role read test, one table at a time (uncomment/run any you
-- want to double check — expect "permission denied for table ..." on
-- every one):
--
--   begin;
--   set local role anon;
--   select count(*) from customers;
--   rollback;
