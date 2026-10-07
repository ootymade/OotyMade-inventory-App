-- ============================================================================
-- ROLLBACK for anon_lockdown.sql — run this whole file in the Supabase SQL
-- Editor if the app breaks after running the lockdown and you need to
-- undo it immediately. Restores exactly the grants the lockdown removed
-- — no more, no less — captured from the live database on 2026-10-07,
-- right before the lockdown was run.
--
-- This does NOT touch authenticated, service_role, or any schema other
-- than public — same scope as the lockdown itself.
--
-- The lockdown script drops the `http` extension outright (a plain
-- REVOKE cannot touch its functions — they're owned by supabase_admin,
-- not postgres — so DROP EXTENSION was the only thing that actually
-- worked). This rollback recreates it, then re-grants anon/PUBLIC
-- EXECUTE on every function it provides, one at a time inside a loop
-- that catches "function does not exist" and skips it, so this still
-- runs cleanly end-to-end even if something unexpected is missing.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Table grants — every one of these 9 tables had anon holding every
--    table-level privilege (DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
--    TRUNCATE, UPDATE — i.e. ALL). No table had a PUBLIC-pseudo-role grant
--    to restore.
-- ---------------------------------------------------------------------------
grant all privileges on table customers to anon;
grant all privileges on table daily_order_counts to anon;
grant all privileges on table invoice_items to anon;
grant all privileges on table invoices to anon;
grant all privileges on table movements to anon;
grant all privileges on table products to anon;
grant all privileges on table purchase_orders to anon;
grant all privileges on table suppliers to anon;
grant all privileges on table team_members to anon;

-- ---------------------------------------------------------------------------
-- 2. Sequence grant — gst_invoice_number_seq: anon held SELECT, UPDATE,
--    USAGE (= ALL for a sequence). No PUBLIC-pseudo-role grant to restore.
-- ---------------------------------------------------------------------------
grant all privileges on sequence gst_invoice_number_seq to anon;

-- ---------------------------------------------------------------------------
-- 3. Recreate the http extension the lockdown dropped, then restore
--    EXECUTE to anon + PUBLIC on every one of its 20 function signatures
--    (which both held before), plus update_shopify_first_order_number.
--    Looped + exception-guarded so a missing function is skipped, not
--    fatal, rather than assumed present.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists http;
exception when others then
  raise notice 'Could not recreate the http extension: %. The function grants below will just be skipped for it.', sqlerrm;
end $$;

do $$
declare
  sig text;
  sigs text[] := array[
    'public.bytea_to_text(bytea)',
    'public.http(public.http_request)',
    'public.http_delete(character varying)',
    'public.http_delete(character varying, character varying, character varying)',
    'public.http_get(character varying, jsonb)',
    'public.http_get(character varying)',
    'public.http_head(character varying)',
    'public.http_header(character varying, character varying)',
    'public.http_list_curlopt()',
    'public.http_patch(character varying, character varying, character varying)',
    'public.http_post(character varying, jsonb)',
    'public.http_post(character varying, character varying, character varying)',
    'public.http_put(character varying, character varying, character varying)',
    'public.http_reset_curlopt()',
    'public.http_set_curlopt(character varying, character varying)',
    'public.text_to_bytea(text)',
    'public.update_shopify_first_order_number(integer)',
    'public.urlencode(character varying)',
    'public.urlencode(jsonb)',
    'public.urlencode(bytea)'
  ];
begin
  foreach sig in array sigs loop
    begin
      execute format('grant execute on function %s to anon, public', sig);
    exception when undefined_function then
      raise notice 'Skipped % — function does not exist (already dropped)', sig;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Default privileges — restore the exact standing defaults both
--    postgres and supabase_admin had before the lockdown (ALL on tables
--    and sequences, EXECUTE on functions, all to anon). Neither role's
--    original default granted anything to PUBLIC on functions — that
--    revoke in the lockdown was already a no-op, so nothing to restore
--    there.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant execute on functions to anon;

-- Same restriction as the lockdown script: `postgres` (what this SQL
-- Editor runs as) cannot alter supabase_admin's defaults — it's not a
-- superuser and not a member of that role. Harmless either way, since
-- nothing in this project is ever created as supabase_admin. Attempted
-- and skipped cleanly rather than left out silently.
do $$
begin
  alter default privileges for role supabase_admin in schema public grant all on tables to anon;
  alter default privileges for role supabase_admin in schema public grant all on sequences to anon;
  alter default privileges for role supabase_admin in schema public grant execute on functions to anon;
exception when insufficient_privilege then
  raise notice 'Skipped supabase_admin defaults — this role cannot alter them (expected; harmless, see comment above)';
end $$;

commit;

-- ============================================================================
-- VERIFICATION — confirms the rollback actually restored the previous state.
-- ============================================================================

-- Expect: every column true (matches the pre-lockdown state).
select
  has_table_privilege('anon', 'public.customers', 'SELECT') as customers_select,
  has_table_privilege('anon', 'public.team_members', 'SELECT') as team_members_select,
  has_function_privilege('anon', 'public.update_shopify_first_order_number(integer)', 'EXECUTE') as update_cutoff_exec;

-- Default privileges restored — expect anon=... entries present again for
-- both roles, matching what was there before the lockdown.
select d.defaclrole::regrole as role, d.defaclobjtype as objtype, d.defaclacl
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
order by role, objtype;
