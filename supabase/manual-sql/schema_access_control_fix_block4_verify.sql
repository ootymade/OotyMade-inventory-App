-- VERIFICATION — run after blocks 1, 2 and 3. Paste this whole file
-- into its own SQL Editor tab and click Run. It opens a transaction,
-- pretends to be two different people, records what each one could
-- see and do, and then ROLLS BACK at the end — nothing it does is
-- kept, including the "stranger" test's attempts to plant a fake
-- product, rename a real one, or wipe the movement history.
--
-- WHAT YOU SHOULD SEE: one row per test. Every row starting with
-- "A_" (the real admin) should show real numbers or "PASS" — those
-- are proof the fix did not take anything away from your own team.
-- Every row starting with "B_" (a stranger with no team_members row)
-- should show 0 or "PASS - blocked" — those are proof the fix closed
-- the gap. Any "B_" row that is NOT 0 / NOT blocked means something
-- is still open — stop and send me that row.
begin;

create temporary table test_results (test text, result text);

-- ---- as the real admin (Vijayakumar) ----
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','44f630f9-a5be-4470-9cf6-fb38cddf302e','role','authenticated')::text, true);

insert into test_results(test, result)
select 'A_admin_read_products', (select count(*)::text from products)
union all select 'A_admin_read_customers', (select count(*)::text from customers)
union all select 'A_admin_read_invoices', (select count(*)::text from invoices)
union all select 'A_admin_read_movements', (select count(*)::text from movements)
union all select 'A_admin_read_team_members', (select count(*)::text from team_members)
union all select 'A_admin_read_couriers', (select count(*)::text from couriers)
union all select 'A_admin_read_shipments', (select count(*)::text from shipments)
union all select 'A_admin_read_shopify_orders_view', (select count(*)::text from shopify_orders_view)
union all select 'A_admin_read_shopify_order_items_view', (select count(*)::text from shopify_order_items_view);

-- ---- as a stranger: a random id that is NOT in team_members ----
select set_config('request.jwt.claims', json_build_object('sub','11111111-2222-3333-4444-555555555555','role','authenticated')::text, true);

insert into test_results(test, result)
select 'B_stranger_read_products', (select count(*)::text from products)
union all select 'B_stranger_read_customers', (select count(*)::text from customers)
union all select 'B_stranger_read_invoices', (select count(*)::text from invoices)
union all select 'B_stranger_read_invoice_items', (select count(*)::text from invoice_items)
union all select 'B_stranger_read_movements', (select count(*)::text from movements)
union all select 'B_stranger_read_team_members', (select count(*)::text from team_members)
union all select 'B_stranger_read_couriers', (select count(*)::text from couriers)
union all select 'B_stranger_read_shipments', (select count(*)::text from shipments)
union all select 'B_stranger_read_shopify_settings', (select count(*)::text from shopify_settings)
union all select 'B_stranger_read_shopify_sync_ping', (select count(*)::text from shopify_sync_ping)
union all select 'B_stranger_read_shopify_orders_view', (select count(*)::text from shopify_orders_view)
union all select 'B_stranger_read_shopify_order_items_view', (select count(*)::text from shopify_order_items_view)
union all select 'B_stranger_read_daily_order_counts', (select count(*)::text from daily_order_counts)
union all select 'B_stranger_read_purchase_orders', (select count(*)::text from purchase_orders)
union all select 'B_stranger_read_suppliers', (select count(*)::text from suppliers);

do $$
begin
  insert into products (sku, name, quantity) values ('HACK-TEST-FIX-CHECK', 'Intruder product', 1);
  insert into test_results(test,result) values ('B_stranger_write_products_insert', 'FAIL - insert succeeded (BAD)');
exception when others then
  insert into test_results(test,result) values ('B_stranger_write_products_insert', 'PASS - blocked');
end $$;

do $$
declare v_pid uuid; v_name_before text; v_name_after text;
begin
  select id, name into v_pid, v_name_before from products limit 1;
  update products set name = 'tampered by stranger' where id = v_pid;
  select name into v_name_after from products where id = v_pid;
  if v_name_after = 'tampered by stranger' then
    insert into test_results(test,result) values ('B_stranger_write_products_update', 'FAIL - update took effect (BAD)');
  else
    insert into test_results(test,result) values ('B_stranger_write_products_update', 'PASS - blocked');
  end if;
end $$;

do $$
declare v_count_before int; v_count_after int;
begin
  select count(*) into v_count_before from movements;
  delete from movements;
  select count(*) into v_count_after from movements;
  if v_count_after < v_count_before then
    insert into test_results(test,result) values ('B_stranger_write_movements_delete', 'FAIL - rows deleted (BAD)');
  else
    insert into test_results(test,result) values ('B_stranger_write_movements_delete', 'PASS - blocked');
  end if;
end $$;

do $$
declare v_pid uuid;
begin
  select id into v_pid from products limit 1;
  perform adjust_stock(v_pid, 999, 'hack', 'stranger rpc test', 'Fake Name', 'admin');
  insert into test_results(test,result) values ('B_stranger_rpc_adjust_stock', 'FAIL - rpc succeeded (BAD)');
exception when others then
  insert into test_results(test,result) values ('B_stranger_rpc_adjust_stock', 'PASS - blocked');
end $$;

do $$
begin
  perform receive_purchase_order('00000000-0000-0000-0000-000000000000'::uuid, '[]'::jsonb, 'Fake Name', 'admin');
  insert into test_results(test,result) values ('B_stranger_rpc_receive_purchase_order', 'FAIL - rpc succeeded (BAD)');
exception when others then
  insert into test_results(test,result) values ('B_stranger_rpc_receive_purchase_order', 'PASS - blocked');
end $$;

select test, result from test_results order by test;

rollback;
