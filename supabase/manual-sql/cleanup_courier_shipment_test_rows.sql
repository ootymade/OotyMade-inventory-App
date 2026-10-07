-- Run this in the Supabase SQL Editor. The execute_sql tool timed out on
-- these DELETEs (same pattern as other DML/DDL this session, even for a
-- single row), so per instruction this is written to a file instead of
-- retried.
--
-- What these rows are: test data from verifying the new set_shipment RPC
-- and the couriers admin-only RLS policy by role simulation. One test
-- courier, and two test shipment rows -- one attached to the real
-- below-cutoff test order (#16591, already slated for your pending
-- delete), the other attached to your one real invoice. That second one
-- is worth running before the Direct Orders shipment UI goes live, since
-- it would otherwise show a fake "DTDC / DIRECT-TEST-001" tracking entry
-- on a real invoice.

delete from shipments where id in (
  '746bdd4b-3b7d-44e6-9e2d-247ca52b1dd5', -- shopify_order_id 21fe8ebc..., tracking UPDATED999
  'fb0a4233-e306-4d47-8524-f048be66bc74'  -- invoice_id 804a7b78..., tracking DIRECT-TEST-001
);

delete from couriers where id = 'de2db899-8b25-481d-b0a9-fc41e9ab781b'; -- "Admin Test Courier"

-- Verification: both should return zero rows.
select * from shipments where id in ('746bdd4b-3b7d-44e6-9e2d-247ca52b1dd5', 'fb0a4233-e306-4d47-8524-f048be66bc74');
select * from couriers where name = 'Admin Test Courier';
