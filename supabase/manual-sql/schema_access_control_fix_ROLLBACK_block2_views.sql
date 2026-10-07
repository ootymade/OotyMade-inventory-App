-- ROLLBACK for block 2 — restores the previous LEFT JOIN views. Only
-- run this if block 2 needs to be fully undone; it reopens the PII
-- leak the block closed (any signed-in stranger could read customer
-- name/phone/email/address and order items again). Paste into its
-- own tab and Run.
begin;

create or replace view shopify_orders_view as
 SELECT so.id,
    so.shopify_order_id,
    so.order_number,
    so.shopify_created_at,
    so.shopify_updated_at,
    so.cancelled_at,
    so.fulfillment_status,
    so.customer_name,
    so.customer_phone,
    so.customer_email,
    so.shipping_address,
    so.billing_address,
    so.tags,
    so.note,
    so.workflow_status,
    so.workflow_updated_by,
    so.workflow_updated_at,
    so.synced_at,
        CASE
            WHEN (tm.role = 'admin'::text) THEN so.financial_status
            ELSE NULL::text
        END AS financial_status,
        CASE
            WHEN (tm.role = 'admin'::text) THEN so.currency
            ELSE NULL::text
        END AS currency,
        CASE
            WHEN (tm.role = 'admin'::text) THEN so.subtotal_price
            ELSE NULL::numeric
        END AS subtotal_price,
        CASE
            WHEN (tm.role = 'admin'::text) THEN so.total_tax
            ELSE NULL::numeric
        END AS total_tax,
        CASE
            WHEN (tm.role = 'admin'::text) THEN so.total_price
            ELSE NULL::numeric
        END AS total_price,
    ((so.cancelled_at IS NOT NULL) OR (so.financial_status = ANY (ARRAY['PENDING'::text, 'VOIDED'::text, 'REFUNDED'::text]))) AS payment_hold,
    (so.financial_status = 'AUTHORIZED'::text) AS is_cod,
    so.workflow_hold_override_reason,
    so.workflow_hold_override_by,
    so.workflow_hold_override_at
   FROM (shopify_orders so
     LEFT JOIN team_members tm ON ((tm.id = ( SELECT auth.uid() AS uid))));

create or replace view shopify_order_items_view as
 SELECT oi.id,
    oi.order_id,
    oi.shopify_line_item_id,
    oi.sku,
    oi.title,
    oi.variant_title,
    oi.quantity,
    oi.unfulfilled_quantity,
    oi.product_id,
        CASE
            WHEN (tm.role = 'admin'::text) THEN oi.unit_price
            ELSE NULL::numeric
        END AS unit_price
   FROM (shopify_order_items oi
     LEFT JOIN team_members tm ON ((tm.id = ( SELECT auth.uid() AS uid))));

commit;

select 'ROLLBACK BLOCK 2 APPLIED' as status;
