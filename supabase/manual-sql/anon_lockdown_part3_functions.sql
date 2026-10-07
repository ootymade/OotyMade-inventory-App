-- anon_lockdown_part3_functions.sql — written 2026-10-07, based on commit
-- 1906dfcee0f9129f79a4941c4faac4c4b18e426d. Check `git log` on this path
-- for the commit that actually matters when comparing against GitHub.
--
-- PART 3 of 5 — FUNCTIONS YOU OWN (not the http extension's — those are
-- owned by supabase_admin and handled separately in part 5, since a
-- plain REVOKE on them silently does nothing; see that file). Runs
-- independently of parts 1, 2, 4 and 5.
--
-- What it does, in order:
--   1. Revokes EXECUTE on every function in public from anon and PUBLIC.
--      This also touches the http extension's functions, but has no
--      effect on them (you don't own them) — harmless to include,
--      tested, no error either way.
--   2. Explicitly re-GRANTs EXECUTE to `authenticated` on the exact 10
--      functions the app actually calls, by name, instead of relying on
--      "the revoke above didn't name authenticated so it must still be
--      fine" — this makes authenticated's access an explicit assertion
--      in this file, not an assumption. The list below is the complete,
--      current set — confirmed by querying pg_proc directly right
--      before writing this file, not from memory.
--
-- This is the one part most likely to reveal a mistake if the function
-- list below is ever incomplete (a staff action starts failing with
-- "permission denied for function ..."), so test every one of the 10
-- actions on your phone after running this — see the chat message for
-- the full list.
-- ============================================================================

begin;

revoke all privileges on all functions in schema public from anon, public;

grant execute on function adjust_stock(uuid, numeric, text, text, text, text, uuid) to authenticated;
grant execute on function confirm_direct_order(uuid, text, text) to authenticated;
grant execute on function mark_product_counted(uuid, text) to authenticated;
grant execute on function receive_purchase_order(uuid, jsonb, text, text) to authenticated;
grant execute on function set_product_gst_rate(uuid, numeric) to authenticated;
grant execute on function set_product_pack_size(uuid, numeric, numeric, text) to authenticated;
grant execute on function set_shipment(uuid, uuid, text, text) to authenticated;
grant execute on function set_shopify_order_workflow_status(uuid, text, text, text) to authenticated;
grant execute on function update_shopify_first_order_number(integer) to authenticated;
grant execute on function upsert_sku_mapping(text, uuid, numeric) to authenticated;

commit;

select 'PART 3 APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - First query: zero rows naming any of the 10 app functions above
--     (anon/PUBLIC can no longer call them). Rows naming http_*,
--     urlencode, bytea_to_text, text_to_bytea are EXPECTED here — those
--     are the ones only part 5 (dropping the extension) can remove;
--     seeing them in this list is not a sign part 3 failed.
--   - Second query: every column true (all 10 app functions still work
--     for authenticated).
-- ============================================================================

select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'adjust_stock', 'confirm_direct_order', 'mark_product_counted',
    'receive_purchase_order', 'set_product_gst_rate', 'set_product_pack_size',
    'set_shipment', 'set_shopify_order_workflow_status',
    'update_shopify_first_order_number', 'upsert_sku_mapping'
  )
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('public', p.oid, 'EXECUTE'));

select
  has_function_privilege('authenticated', 'public.adjust_stock(uuid, numeric, text, text, text, text, uuid)', 'EXECUTE') as adjust_stock,
  has_function_privilege('authenticated', 'public.confirm_direct_order(uuid, text, text)', 'EXECUTE') as confirm_direct_order,
  has_function_privilege('authenticated', 'public.mark_product_counted(uuid, text)', 'EXECUTE') as mark_product_counted,
  has_function_privilege('authenticated', 'public.receive_purchase_order(uuid, jsonb, text, text)', 'EXECUTE') as receive_purchase_order,
  has_function_privilege('authenticated', 'public.set_product_gst_rate(uuid, numeric)', 'EXECUTE') as set_product_gst_rate,
  has_function_privilege('authenticated', 'public.set_product_pack_size(uuid, numeric, numeric, text)', 'EXECUTE') as set_product_pack_size,
  has_function_privilege('authenticated', 'public.set_shipment(uuid, uuid, text, text)', 'EXECUTE') as set_shipment,
  has_function_privilege('authenticated', 'public.set_shopify_order_workflow_status(uuid, text, text, text)', 'EXECUTE') as set_shopify_order_workflow_status,
  has_function_privilege('authenticated', 'public.update_shopify_first_order_number(integer)', 'EXECUTE') as update_shopify_first_order_number,
  has_function_privilege('authenticated', 'public.upsert_sku_mapping(text, uuid, numeric)', 'EXECUTE') as upsert_sku_mapping;
