-- BLOCK 2 of 3 — fixes a separate leak in the two Shopify views. They
-- already hid the money fields (price, tax, etc.) from non-admins,
-- but they used a LEFT JOIN to team_members, which meant a stranger
-- with no team_members row at all still got every row back — full
-- customer name, phone, email and address, and every order's line
-- items. Changing the LEFT JOIN to a plain JOIN means a row is only
-- returned at all if the caller has a team_members row; everything
-- else about the views (the admin-only money columns) is unchanged.
-- Paste this whole file into its own SQL Editor tab and click Run.
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
     JOIN team_members tm ON ((tm.id = ( SELECT auth.uid() AS uid))));

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
     JOIN team_members tm ON ((tm.id = ( SELECT auth.uid() AS uid))));

commit;

select 'BLOCK 2 APPLIED' as status;
