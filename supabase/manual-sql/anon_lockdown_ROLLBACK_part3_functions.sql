-- anon_lockdown_ROLLBACK_part3_functions.sql — rollback for
-- anon_lockdown_part3_functions.sql. Independent of the other rollback
-- parts.
--
-- Of the 10 functions part 3 touches, only ONE —
-- update_shopify_first_order_number — actually had anon/PUBLIC EXECUTE
-- before part 3 ran; the other 9 (adjust_stock, confirm_direct_order,
-- mark_product_counted, receive_purchase_order, set_product_gst_rate,
-- set_product_pack_size, set_shipment, set_shopify_order_workflow_status,
-- upsert_sku_mapping) never had anon/PUBLIC access at all — confirmed
-- directly before writing this file. So this rollback restores access
-- to exactly that one function, not all ten; granting the other nine to
-- anon/PUBLIC would be creating a new hole, not undoing one.
--
-- authenticated's EXECUTE on all 10 is untouched by this rollback —
-- part 3 never removed it (it re-granted in the same breath it
-- revoked), so there is nothing to restore there.
-- ============================================================================

begin;

grant execute on function update_shopify_first_order_number(integer) to anon, public;

commit;

select 'ROLLBACK PART 3 APPLIED' as status;

-- Verification — expect true (matches pre-lockdown state).
select has_function_privilege('anon', 'public.update_shopify_first_order_number(integer)', 'EXECUTE') as anon_cutoff_exec;
