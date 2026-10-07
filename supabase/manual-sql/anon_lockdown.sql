-- ============================================================================
-- ANON LOCKDOWN — run this whole file in the Supabase SQL Editor.
--
-- What this does:
--   1. Revokes every raw privilege (SELECT/INSERT/UPDATE/DELETE/EXECUTE/etc.)
--      that the `anon` role, or the PUBLIC pseudo-role (= "every role"),
--      currently holds on anything in the public schema: tables, views,
--      sequences, functions.
--   2. Rewrites the stored default-privilege entries for the two roles that
--      actually create objects in this project (`postgres`, the normal SQL
--      Editor/migration role, and `supabase_admin`) so that a future
--      CREATE TABLE/FUNCTION/SEQUENCE does not automatically hand anon
--      anything again. Right now both roles have a standing default that
--      grants anon full CRUD/EXECUTE on every new object — that's the
--      Supabase project-template default, and it's what's been quietly
--      giving every table created this session (and before) a raw anon
--      grant even though RLS blocked the actual data.
--   3. Touches nothing belonging to `authenticated` or `service_role` —
--      every grant they currently have stays exactly as it is.
--
-- Why this is believed SAFE (read before running):
--   - Role-simulated as `anon` (SET LOCAL ROLE anon inside a transaction,
--     rolled back): every one of the 9 tables that had a raw anon grant
--     (customers, daily_order_counts, invoice_items, invoices, movements,
--     products, purchase_orders, suppliers, team_members) already returns
--     ZERO rows to anon today, and an anon INSERT into customers was
--     already rejected with "new row violates row-level security policy".
--     RLS was already doing its job. This script closes the raw-grant gap
--     RLS was quietly covering for, it does not change what currently
--     works.
--   - The only function anon could actually call with any real effect,
--     update_shopify_first_order_number(integer), has its own internal
--     check ("if not exists (select 1 from team_members where id =
--     auth.uid() and role = 'admin') then raise exception 'Admin only'")
--     — confirmed by actually calling it as anon: it raised "Admin only",
--     not the setting change. So it was not exploitable either, but it
--     should not have been reachable in the first place.
--   - The `http`, `http_get`, `http_post`, ... functions (from the `http`
--     Postgres extension, installed into the public schema) and their
--     `urlencode`/`bytea_to_text`/`text_to_bytea` helpers were callable by
--     anon with NO internal check at all — this is a genuine SSRF-class
--     gap (anyone with the public anon key could make the database server
--     issue outbound HTTP requests). I grepped the whole frontend and
--     found no call to any of these from the app, and there are no
--     triggers and no pg_cron jobs in this project that use them either —
--     nothing in this codebase depends on anon/PUBLIC keeping access.
--   - No view, table, or function has a policy or grant that names the
--     `anon` role directly. Every policy that is scoped to `roles: public`
--     (customers, daily_order_counts, invoice_items, invoices, movements,
--     products, purchase_orders, suppliers, team_members, shopify_sync_ping,
--     shopify_sku_map) has a condition of `auth.role() = 'authenticated'`,
--     which is false for anon — so none of them are "effectively true" for
--     an anon request. The only truly unconditional (`qual = true`)
--     policies are on couriers/shipments/shopify_settings, and all three
--     are scoped to `roles: {authenticated}` only, which excludes anon at
--     the role level before the condition even runs.
--
-- NOT fixed by this script — flagged for a separate decision, not bundled
-- in here because it needs new RLS policies, not just revokes:
--   shopify_orders, shopify_order_items and shopify_token_cache have RLS
--   ENABLED but ZERO POLICIES. The only way anyone (including staff) reads
--   them today is through three views (shopify_orders_view,
--   shopify_order_items_view, shopify_unmapped_skus_view) that are defined
--   SECURITY DEFINER — meaning those views bypass RLS on the underlying
--   tables entirely and run with the view owner's privileges instead.
--   Right now this is safe only because the views themselves have no
--   anon/PUBLIC grant (confirmed below), but it means the real access
--   control for Shopify order data lives entirely in 3 GRANT statements
--   on 3 views, not in RLS on the tables the data actually lives in. If
--   you ever want this layered the normal way (RLS on the base tables,
--   `security_invoker = true` on the views), that's a separate, larger
--   change — it needs real SELECT policies added to 3 tables first, or
--   every screen that reads Shopify orders breaks. Tell me if you want
--   this as its own step; I did not touch it here.
--
-- Also outside this script's scope, mentioned for completeness:
--   - Supabase Auth's "leaked password protection" is disabled project-wide
--     — that's a toggle in Authentication settings on the dashboard, not
--     something SQL can fix.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Strip anon + PUBLIC from every existing object in the public schema.
--    "ALL TABLES IN SCHEMA" covers plain tables AND views in Postgres.
-- ---------------------------------------------------------------------------
revoke all privileges on all tables in schema public from anon, public;
revoke all privileges on all sequences in schema public from anon, public;
revoke all privileges on all functions in schema public from anon, public;

-- ---------------------------------------------------------------------------
-- 2. Default privileges for objects created in the future. Two roles can
--    currently create objects here (postgres, supabase_admin) and both have
--    a stored default that hands anon everything on anything new — cancel
--    that on both, for tables, sequences and functions.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on functions from public;

alter default privileges for role supabase_admin in schema public revoke all on tables from anon;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon;
alter default privileges for role supabase_admin in schema public revoke all on functions from public;

commit;

-- ============================================================================
-- VERIFICATION — run after the block above commits. All read-only.
-- ============================================================================

-- 2a. Raw grants: anon/PUBLIC should now own nothing in public schema.
--     Expect: zero rows back from each of these three.
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'public');

select p.proname, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'));

select s.relname, has_sequence_privilege('anon', s.oid, 'SELECT') as anon_select,
       has_sequence_privilege('anon', s.oid, 'USAGE') as anon_usage
from pg_class s
join pg_namespace n on n.oid = s.relnamespace
where s.relkind = 'S' and n.nspname = 'public'
  and (has_sequence_privilege('anon', s.oid, 'SELECT') or has_sequence_privilege('anon', s.oid, 'USAGE'));

-- 2b. Spot-check the specific gaps this script closes.
--     Expect: every column below is false.
select
  has_table_privilege('anon', 'public.customers', 'SELECT') as customers_select,
  has_table_privilege('anon', 'public.team_members', 'SELECT') as team_members_select,
  has_table_privilege('anon', 'public.invoices', 'SELECT') as invoices_select,
  has_function_privilege('anon', 'public.update_shopify_first_order_number(integer)', 'EXECUTE') as update_cutoff_exec,
  has_function_privilege('anon', 'public.http_get(character varying)', 'EXECUTE') as http_get_exec,
  has_function_privilege('anon', 'public.urlencode(text)', 'EXECUTE') as urlencode_exec;

-- 2c. authenticated must be completely unaffected. Expect: every column true.
select
  has_table_privilege('authenticated', 'public.customers', 'SELECT') as customers_select,
  has_table_privilege('authenticated', 'public.team_members', 'SELECT') as team_members_select,
  has_function_privilege('authenticated', 'public.set_shipment(uuid, uuid, text, text)', 'EXECUTE') as set_shipment_exec,
  has_function_privilege('authenticated', 'public.set_shopify_order_workflow_status(uuid, text, text, text)', 'EXECUTE') as workflow_status_exec,
  has_function_privilege('authenticated', 'public.update_shopify_first_order_number(integer)', 'EXECUTE') as update_cutoff_exec,
  has_table_privilege('authenticated', 'public.couriers', 'SELECT') as couriers_select;

-- 2d. Table-by-table anon row count via role simulation, read-only,
--     rolled back regardless of what it finds. Expect: every count is 0,
--     and the block raises a permission error for any table/view where
--     anon no longer has even the raw grant (that's the 401-producing
--     state — see the curl check below).
do $$
declare
  r record;
  n int;
begin
  for r in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type in ('BASE TABLE', 'VIEW')
  loop
    begin
      execute format('select count(*) from %I', r.table_name) into n;
      raise notice '% : % rows visible to anon', r.table_name, n;
    exception when insufficient_privilege then
      raise notice '% : permission denied for anon (expected)', r.table_name;
    end;
  end loop;
end $$;
-- The DO block above runs as whatever role is executing this script
-- (normally postgres/superuser in the SQL Editor), not as anon — it is
-- NOT a real anon-role check, just a per-table existence/row-count probe.
-- For an actual anon-role check, run this separately:
--
--   begin;
--   set local role anon;
--   select count(*) from customers;   -- expect: permission denied
--   rollback;
--
-- repeating the select for whichever table you want to double check.

-- ============================================================================
-- HOW TO CHECK THIS YOURSELF FROM OUTSIDE THE DATABASE (no sandbox can do
-- this for you — it has no network path to your Supabase project):
--
-- Pick any table that had a raw anon grant before this script, e.g.
-- team_members, and run, from any terminal with curl:
--
--   curl -i "https://mzqgpeswsrumybvzghut.supabase.co/rest/v1/team_members?select=*" \
--     -H "apikey: <the anon key from .env / VITE_SUPABASE_ANON_KEY>"
--
-- Before this script: HTTP 200 with body "[]" (RLS was already hiding the
-- rows, but the raw grant let the request through).
-- After this script: HTTP 401, with a JSON body naming "42501" /
-- "permission denied for table team_members". That 401 is the PostgREST
-- rule: a 42501 (insufficient_privilege) error on the anon role maps to
-- 401, not 403 or 200 — so 401 here is the confirmation this worked.
--
-- Also worth trying the same way against the RPC that is now closed:
--
--   curl -i -X POST "https://mzqgpeswsrumybvzghut.supabase.co/rest/v1/rpc/update_shopify_first_order_number" \
--     -H "apikey: <the anon key>" \
--     -H "Content-Type: application/json" \
--     -d '{"p_number": 1}'
--
-- Expect 401 after this script (it already failed safely with "Admin
-- only" before, from its own internal check, but it should now also be
-- unreachable at the grant level).
--
-- Then confirm staff logins still work exactly as before: sign in as any
-- team member in the actual app and check that the dashboard, products,
-- orders and shipment screens all still load data normally — that is the
-- "authenticated still works" side of this that only a real login can
-- confirm, no curl command substitutes for it.
-- ============================================================================
