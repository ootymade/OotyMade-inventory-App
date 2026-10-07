-- anon_lockdown_part5_drop_http_extension.sql — written 2026-10-07, based
-- on commit 1906dfcee0f9129f79a4941c4faac4c4b18e426d. Check `git log` on
-- this path for the commit that actually matters when comparing against
-- GitHub.
--
-- PART 5 of 5 — DROP THE http EXTENSION. Independently runnable: does
-- not need part 1, 2, 3 or 4. THIS IS THE RISKIEST OF THE FIVE PARTS —
-- see the chat message for why, and run it last.
--
-- Why a DROP instead of a REVOKE: the http extension's 20 functions
-- (http, http_get, http_post, http_delete, http_head, http_patch,
-- http_put, http_header, http_list_curlopt, http_reset_curlopt,
-- http_set_curlopt, urlencode x3, bytea_to_text, text_to_bytea) are
-- owned by supabase_admin, not postgres. A REVOKE run as postgres on an
-- object it doesn't own and isn't superuser for does NOTHING and
-- raises NO ERROR either — tested directly — so it would look
-- successful while leaving every one of these exactly as anon/PUBLIC-
-- executable as before. This is a genuine SSRF-class gap: anyone with
-- the public anon key could make the database server issue outbound
-- HTTP requests. DROP EXTENSION is the one operation Supabase does let
-- `postgres` run on an extension regardless of who owns it — tested,
-- confirmed it works.
--
-- Why this is the riskiest part: unlike parts 1-4, which only remove a
-- permission RLS had already made unreachable, this one REMOVES the
-- functions themselves — for anon, PUBLIC, authenticated and
-- service_role alike, not just anon/PUBLIC. Checked thoroughly before
-- proposing this: no table/view/column in this schema, no trigger, and
-- no pg_cron job references these functions, and the only place
-- "ANON_KEY" appears across all three Edge Functions
-- (shopify-sync-orders, shopify-webhook, shopify-payment-diagnostics)
-- is to verify a caller's JWT via auth.getUser() — never to call an
-- http_* function; every real data operation in those functions uses
-- the service_role key instead. So nothing in this codebase should
-- notice. But a DROP is a bigger action than a REVOKE, and if that
-- assessment is ever wrong, this is the part that would actually
-- break something, not just narrow a permission nothing used.
-- ============================================================================

begin;

drop extension if exists http;

commit;

select 'PART 5 APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - extension_present: false
--   - remaining_http_functions: 0
-- ============================================================================

select
  exists(select 1 from pg_extension where extname = 'http') as extension_present,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'http%') as remaining_http_functions;
