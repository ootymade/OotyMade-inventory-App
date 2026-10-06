-- Ooty Inventory — Supabase schema
-- This file mirrors what's live in the "OM Stock Inventory 2026" Supabase
-- project. Safe to re-run top-to-bottom against a fresh project, or as a
-- reference for what's there — uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS throughout.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core inventory tables
-- ---------------------------------------------------------------------------

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text default '',
  phone text default '',
  email text default '',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text default '',
  unit text not null default 'pcs',
  quantity numeric not null default 0,
  low_stock_threshold numeric not null default 0,
  supplier_id uuid references suppliers(id) on delete set null,
  unit_cost numeric not null default 0,
  photo text default '',
  hsn_code text not null default '1806',
  -- Set only for products sold as fixed-weight packs counted in Nos
  -- (unit='pcs'), e.g. a 500g pack — lets the app compute total weight on
  -- hand (quantity * pack_size_grams) instead of tracking raw fractional
  -- kg/g quantities directly.
  pack_size_grams numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received')),
  items jsonb not null default '[]',
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  quantity numeric not null,
  reason text default 'adjustment',
  note text default '',
  member_name text default '',
  member_role text default '',
  po_id uuid references purchase_orders(id) on delete set null,
  "timestamp" timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movements_product_id_idx on movements(product_id);
create index if not exists movements_timestamp_idx on movements("timestamp" desc);
create index if not exists movements_po_id_idx on movements(po_id);
create index if not exists products_supplier_id_idx on products(supplier_id);
create index if not exists purchase_orders_supplier_id_idx on purchase_orders(supplier_id);

-- ---------------------------------------------------------------------------
-- Customers (Direct Orders)
-- ---------------------------------------------------------------------------

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text default '',
  address text default '',
  state text default 'Tamil Nadu',
  gstin text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices & proforma invoices (Direct Orders)
-- ---------------------------------------------------------------------------

-- Sequential, gap-resistant GST invoice numbers. Only assigned when a
-- proforma is confirmed into a real GST invoice (see confirm_direct_order).
create sequence if not exists gst_invoice_number_seq start 1;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'proforma' check (kind in ('proforma', 'gst')),
  invoice_number integer unique,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  customer_id uuid references customers(id) on delete set null,
  customer_name_snapshot text not null default '',
  customer_phone_snapshot text default '',
  customer_address_snapshot text default '',
  customer_state_snapshot text default 'Tamil Nadu',
  customer_gstin_snapshot text default '',
  subtotal numeric not null default 0,
  cgst numeric not null default 0,
  sgst numeric not null default 0,
  igst numeric not null default 0,
  total numeric not null default 0,
  courier_name text default '',
  tracking_number text default '',
  note text default '',
  created_by text default '',
  created_by_role text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_customer_id_idx on invoices(customer_id);
create index if not exists invoices_created_at_idx on invoices(created_at desc);
create index if not exists invoices_status_idx on invoices(status);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null,
  hsn_code text not null default '1806',
  quantity numeric not null,
  unit_price numeric not null,
  line_total numeric not null
);

create index if not exists invoice_items_invoice_id_idx on invoice_items(invoice_id);
create index if not exists invoice_items_product_id_idx on invoice_items(product_id);

-- ---------------------------------------------------------------------------
-- Daily order count log (manual, one row per date + channel)
-- ---------------------------------------------------------------------------

create table if not exists daily_order_counts (
  order_date date not null,
  channel text not null,
  order_count integer not null default 0,
  entered_by text default '',
  updated_at timestamptz not null default now(),
  primary key (order_date, channel)
);

create index if not exists daily_order_counts_date_idx on daily_order_counts(order_date desc);

-- ---------------------------------------------------------------------------
-- Team members — one row per person, id = their own auth.users id. Each of
-- the 6 team members now has their own Supabase Auth login (replacing the
-- single shared login) so RLS policies can tell who's asking — needed to
-- enforce "Staff can't see revenue" at the database level, not just the UI.
-- Seeding the 6 accounts (auth.users + auth.identities + this table) is a
-- one-off operational script, intentionally not kept here since it embeds
-- initial passwords — see chat history for that migration if ever re-run.
-- ---------------------------------------------------------------------------

create table if not exists team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  -- 'admin'/'staff' access level, used only for Shopify revenue masking
  -- server-side — never shown to the user as a label.
  role text not null check (role in ('admin', 'staff')),
  -- Descriptive title (e.g. "Director") used for movement/invoice
  -- attribution display — same role the old shared-login name picker
  -- showed, kept separate from the admin/staff access level above.
  title text not null default '',
  created_at timestamptz not null default now()
);

alter table team_members enable row level security;

drop policy if exists "team members readable by any signed-in user" on team_members;
create policy "team members readable by any signed-in user" on team_members
  for select using ((select auth.role()) = 'authenticated');
-- Deliberately no insert/update/delete policy — roles are managed directly
-- via SQL, never from the client.

-- ---------------------------------------------------------------------------
-- Row Level Security — only a signed-in team member can read or write
-- anything. The public anon key alone gets nothing. auth.role() is wrapped
-- as (select auth.role()) so Postgres evaluates it once per query instead
-- of once per row (see auth_rls_initplan advisor).
-- ---------------------------------------------------------------------------

alter table suppliers enable row level security;
alter table products enable row level security;
alter table purchase_orders enable row level security;
alter table movements enable row level security;
alter table customers enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table daily_order_counts enable row level security;

drop policy if exists "team full access" on suppliers;
create policy "team full access" on suppliers
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on products;
create policy "team full access" on products
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on purchase_orders;
create policy "team full access" on purchase_orders
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on movements;
create policy "team full access" on movements
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on customers;
create policy "team full access" on customers
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on invoices;
create policy "team full access" on invoices
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on invoice_items;
create policy "team full access" on invoice_items
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "team full access" on daily_order_counts;
create policy "team full access" on daily_order_counts
  for all using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- ---------------------------------------------------------------------------
-- Atomic stock operations. With several people editing the same product at
-- once, a naive "read quantity, compute new value, write it back" from the
-- browser can silently lose one person's change (classic lost-update race).
-- These run as a single database statement/transaction instead, so
-- concurrent edits are always serialized correctly by Postgres.
--
-- SECURITY: Postgres grants EXECUTE on new functions to PUBLIC by default,
-- and Supabase's default privileges additionally grant it to `anon`
-- directly — so `grant ... to authenticated` alone does NOT stop
-- unauthenticated callers. Both must be explicitly revoked below.
-- ---------------------------------------------------------------------------

create or replace function adjust_stock(
  p_product_id uuid,
  p_delta numeric,
  p_reason text,
  p_note text,
  p_member_name text,
  p_member_role text,
  p_po_id uuid default null
) returns products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
begin
  update products
    set quantity = greatest(0, quantity + p_delta),
        updated_at = now()
    where id = p_product_id
    returning * into v_product;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into movements (product_id, type, quantity, reason, note, member_name, member_role, po_id)
  values (
    p_product_id,
    case when p_delta < 0 then 'out' else 'in' end,
    p_delta,
    p_reason,
    p_note,
    p_member_name,
    p_member_role,
    p_po_id
  );

  return v_product;
end;
$$;

revoke execute on function adjust_stock(uuid, numeric, text, text, text, text, uuid) from public, anon;
grant execute on function adjust_stock(uuid, numeric, text, text, text, text, uuid) to authenticated;

create or replace function receive_purchase_order(
  p_po_id uuid,
  p_received jsonb, -- [{"productId": "...", "qty": number}, ...]
  p_member_name text,
  p_member_role text
) returns purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po purchase_orders;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_recv jsonb;
  v_qty numeric;
  v_remaining numeric;
  v_total_ordered numeric := 0;
  v_total_received numeric := 0;
  v_new_status text;
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'Purchase order not found';
  end if;

  for v_item in select * from jsonb_array_elements(v_po.items)
  loop
    select r into v_recv
      from jsonb_array_elements(p_received) r
      where (r->>'productId')::uuid = (v_item->>'productId')::uuid
      limit 1;

    v_remaining := (v_item->>'qtyOrdered')::numeric - (v_item->>'qtyReceived')::numeric;
    v_qty := least(greatest(0, coalesce((v_recv->>'qty')::numeric, 0)), v_remaining);

    if v_qty > 0 then
      update products
        set quantity = quantity + v_qty, updated_at = now()
        where id = (v_item->>'productId')::uuid;

      insert into movements (product_id, type, quantity, reason, note, member_name, member_role, po_id)
      values ((v_item->>'productId')::uuid, 'in', v_qty, 'received', 'PO receipt', p_member_name, p_member_role, p_po_id);
    end if;

    v_item := jsonb_set(v_item, '{qtyReceived}', to_jsonb(((v_item->>'qtyReceived')::numeric + v_qty)));
    v_items := v_items || jsonb_build_array(v_item);

    v_total_ordered := v_total_ordered + (v_item->>'qtyOrdered')::numeric;
    v_total_received := v_total_received + (v_item->>'qtyReceived')::numeric;
  end loop;

  if v_total_received <= 0 then
    v_new_status := v_po.status;
  elsif v_total_received >= v_total_ordered then
    v_new_status := 'received';
  else
    v_new_status := 'partially_received';
  end if;

  update purchase_orders
    set items = v_items, status = v_new_status, updated_at = now()
    where id = p_po_id
    returning * into v_po;

  return v_po;
end;
$$;

revoke execute on function receive_purchase_order(uuid, jsonb, text, text) from public, anon;
grant execute on function receive_purchase_order(uuid, jsonb, text, text) to authenticated;

-- Confirms a draft/proforma order into a numbered GST invoice, atomically:
-- assigns the next sequential invoice number, deducts stock for every line
-- item via the EXISTING adjust_stock function (never a separate/duplicate
-- stock-deduction path), then marks the order confirmed. All in one
-- transaction, so a numbered invoice always has its stock movements.
create or replace function confirm_direct_order(
  p_invoice_id uuid,
  p_member_name text,
  p_member_role text
) returns invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice invoices;
  v_item invoice_items%rowtype;
  v_number integer;
begin
  select * into v_invoice from invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'This order has already been confirmed';
  end if;

  v_number := nextval('gst_invoice_number_seq');

  for v_item in select * from invoice_items where invoice_id = p_invoice_id
  loop
    if v_item.product_id is not null then
      perform adjust_stock(
        v_item.product_id,
        -v_item.quantity,
        'sold',
        'Direct order INV-' || v_number::text,
        p_member_name,
        p_member_role
      );
    end if;
  end loop;

  update invoices
    set kind = 'gst',
        status = 'confirmed',
        invoice_number = v_number,
        updated_at = now()
    where id = p_invoice_id
    returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke execute on function confirm_direct_order(uuid, text, text) from public, anon;
grant execute on function confirm_direct_order(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Shopify Orders (read-only sync, Phase 2 of the Shopify integration).
-- Shopify writes/reads only ever happen inside Supabase Edge Functions
-- (supabase/functions/shopify-sync-orders, shopify-webhook) using a
-- client_credentials token cached in shopify_token_cache — Shopify
-- credentials never reach the browser. These tables never affect
-- `products.quantity`; that's a separate, explicitly-opt-in later phase.
-- ---------------------------------------------------------------------------

create table if not exists shopify_orders (
  id uuid primary key default gen_random_uuid(),
  shopify_order_id text not null unique,
  order_number text not null default '',
  shopify_created_at timestamptz not null,
  shopify_updated_at timestamptz not null,
  cancelled_at timestamptz,
  financial_status text default '',
  fulfillment_status text default '',
  currency text not null default 'INR',
  customer_name text default '',
  customer_phone text default '',
  customer_email text default '',
  shipping_address jsonb,
  billing_address jsonb,
  subtotal_price numeric default 0,
  total_tax numeric default 0,
  total_price numeric default 0,
  tags text default '',
  note text default '',
  -- Internal workflow, distinct from Shopify's own fulfillment_status.
  workflow_status text not null default 'new' check (workflow_status in ('new','packing','packed','shipped','delivered')),
  workflow_updated_by uuid references team_members(id) on delete set null,
  workflow_updated_at timestamptz,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopify_orders_created_idx on shopify_orders(shopify_created_at desc);
create index if not exists shopify_orders_workflow_idx on shopify_orders(workflow_status);

create table if not exists shopify_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references shopify_orders(id) on delete cascade,
  shopify_line_item_id text not null,
  sku text default '',
  title text not null default '',
  variant_title text default '',
  quantity numeric not null default 0,
  unfulfilled_quantity numeric not null default 0,
  unit_price numeric default 0,
  -- Matched by exact SKU against products.sku; null = unmapped (shown as a
  -- warning in the UI, never blocks the order).
  product_id uuid references products(id) on delete set null,
  unique (order_id, shopify_line_item_id)
);
create index if not exists shopify_order_items_order_idx on shopify_order_items(order_id);
create index if not exists shopify_order_items_product_idx on shopify_order_items(product_id);

-- Cached client_credentials OAuth token. Only Edge Functions (service role,
-- which bypasses RLS) ever read/write this — RLS is enabled with zero
-- policies so no client role can touch it either way.
create table if not exists shopify_token_cache (
  id boolean primary key default true check (id),
  access_token text not null,
  expires_at timestamptz not null
);

-- A single-row "something changed" signal the client subscribes to via
-- Realtime, instead of subscribing to shopify_orders directly — Realtime
-- delivers full row payloads regardless of the masking view below, so
-- subscribing to the real table would leak revenue over the wire. Edge
-- Functions touch this row after every successful order upsert.
create table if not exists shopify_sync_ping (
  id boolean primary key default true check (id),
  last_synced_at timestamptz not null default now()
);
insert into shopify_sync_ping (id) values (true) on conflict do nothing;

alter table shopify_orders enable row level security;
alter table shopify_order_items enable row level security;
alter table shopify_token_cache enable row level security;
alter table shopify_sync_ping enable row level security;

drop policy if exists "ping readable" on shopify_sync_ping;
create policy "ping readable" on shopify_sync_ping
  for select using ((select auth.role()) = 'authenticated');

-- No policies at all on shopify_orders/shopify_order_items/shopify_token_cache
-- for `authenticated` — RLS with zero policies blocks every row for every
-- client role. Supabase's default privileges additionally grant table
-- access to anon/authenticated on any new object, so that's revoked too.
revoke all on shopify_orders from authenticated, anon, public;
revoke all on shopify_order_items from authenticated, anon, public;
revoke all on shopify_token_cache from authenticated, anon, public;
revoke all on shopify_sync_ping from authenticated, anon, public;
grant select on shopify_sync_ping to authenticated;

-- Masking views: the only way the client reads Shopify order data. They
-- run as the view owner (bypassing the base tables' RLS lockout above) and
-- apply their own role check against team_members — financial_status,
-- currency, subtotal/tax/total and line-item unit_price all come back
-- null unless the calling auth.uid() maps to an 'admin' team_members row.
-- This enforces "Staff can't see revenue" in Postgres, not just the UI.
create or replace view shopify_orders_view as
select
  so.id, so.shopify_order_id, so.order_number, so.shopify_created_at, so.shopify_updated_at,
  so.cancelled_at, so.fulfillment_status, so.customer_name, so.customer_phone, so.customer_email,
  so.shipping_address, so.billing_address, so.tags, so.note,
  so.workflow_status, so.workflow_updated_by, so.workflow_updated_at, so.synced_at,
  case when tm.role = 'admin' then so.financial_status else null end as financial_status,
  case when tm.role = 'admin' then so.currency else null end as currency,
  case when tm.role = 'admin' then so.subtotal_price else null end as subtotal_price,
  case when tm.role = 'admin' then so.total_tax else null end as total_tax,
  case when tm.role = 'admin' then so.total_price else null end as total_price
from shopify_orders so
left join team_members tm on tm.id = (select auth.uid());

create or replace view shopify_order_items_view as
select
  oi.id, oi.order_id, oi.shopify_line_item_id, oi.sku, oi.title, oi.variant_title,
  oi.quantity, oi.unfulfilled_quantity, oi.product_id,
  case when tm.role = 'admin' then oi.unit_price else null end as unit_price
from shopify_order_items oi
left join team_members tm on tm.id = (select auth.uid());

revoke all on shopify_orders_view from authenticated, anon, public;
revoke all on shopify_order_items_view from authenticated, anon, public;
grant select on shopify_orders_view to authenticated;
grant select on shopify_order_items_view to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopify_sync_ping'
  ) then
    execute 'alter publication supabase_realtime add table public.shopify_sync_ping';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shopify SKU mapping — Shopify's SKUs don't match this catalog's SKU
-- format, so an admin has to confirm shopify_sku -> product_id by hand
-- (quantity_multiplier covers a Shopify SKU that represents N catalog
-- units). Reads/writes are admin-only; upsert_sku_mapping is the only way
-- to write a mapping, and re-resolves every existing shopify_order_items
-- row with that SKU in the same transaction.
-- ---------------------------------------------------------------------------

create table if not exists shopify_sku_map (
  shopify_sku text primary key,
  product_id uuid not null references products(id) on delete cascade,
  quantity_multiplier numeric not null default 1,
  created_by uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table shopify_sku_map enable row level security;

drop policy if exists "admin reads sku map" on shopify_sku_map;
create policy "admin reads sku map" on shopify_sku_map
  for select using (exists (select 1 from team_members tm where tm.id = (select auth.uid()) and tm.role = 'admin'));
-- No insert/update/delete policy — writes only via upsert_sku_mapping().

revoke all on shopify_sku_map from anon, public, authenticated;
grant select on shopify_sku_map to authenticated;

create or replace function upsert_sku_mapping(
  p_shopify_sku text,
  p_product_id uuid,
  p_quantity_multiplier numeric
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;

  insert into shopify_sku_map (shopify_sku, product_id, quantity_multiplier, created_by, updated_at)
  values (p_shopify_sku, p_product_id, coalesce(p_quantity_multiplier, 1), (select auth.uid()), now())
  on conflict (shopify_sku) do update
    set product_id = excluded.product_id,
        quantity_multiplier = excluded.quantity_multiplier,
        updated_at = now();

  update shopify_order_items
    set product_id = p_product_id
    where sku = p_shopify_sku;
end;
$$;

revoke execute on function upsert_sku_mapping(text, uuid, numeric) from public, anon;
grant execute on function upsert_sku_mapping(text, uuid, numeric) to authenticated;

-- Distinct unmapped SKUs seen across synced order items, admin-only (the
-- WHERE clause itself gates it — empty result for anyone who isn't admin).
create or replace view shopify_unmapped_skus_view as
select
  oi.sku,
  max(oi.title) as sample_title,
  count(*) as order_item_count
from shopify_order_items oi
left join team_members tm on tm.id = (select auth.uid())
where oi.product_id is null and oi.sku <> '' and tm.role = 'admin'
group by oi.sku;

revoke all on shopify_unmapped_skus_view from anon, public, authenticated;
grant select on shopify_unmapped_skus_view to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast changes on every table the app reads, so all 5 phones
-- see the same data live.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['products','suppliers','movements','purchase_orders','customers','invoices','invoice_items','daily_order_counts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
