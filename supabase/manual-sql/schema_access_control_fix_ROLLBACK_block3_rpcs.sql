-- ROLLBACK for block 3 — restores the previous versions of the three
-- functions, without the team_members guard. Only run this if block
-- 3 needs to be fully undone; it reopens the gap where any signed-in
-- stranger could call these directly. Paste into its own tab and Run.
begin;

create or replace function public.adjust_stock(p_product_id uuid, p_delta numeric, p_reason text, p_note text, p_member_name text, p_member_role text, p_po_id uuid DEFAULT NULL::uuid)
 RETURNS products
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_product products;
begin
  update products
    set quantity = greatest(0, quantity + p_delta),
        has_been_counted = true,
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
$function$;

create or replace function public.confirm_direct_order(p_invoice_id uuid, p_member_name text, p_member_role text)
 RETURNS invoices
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

create or replace function public.receive_purchase_order(p_po_id uuid, p_received jsonb, p_member_name text, p_member_role text)
 RETURNS purchase_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        set quantity = quantity + v_qty, has_been_counted = true, updated_at = now()
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
$function$;

commit;

select 'ROLLBACK BLOCK 3 APPLIED' as status;
