-- Run this in the Supabase SQL Editor. The execute_sql tool timed out on
-- this DROP (same pattern as other DDL this session), so per instruction
-- this is written to a file instead of retried.
--
-- Why this is needed: set_shopify_order_workflow_status was just recreated
-- with a 4th parameter (p_override_reason). In Postgres, CREATE OR REPLACE
-- with a different parameter list creates a new overload rather than
-- replacing the old one -- the old 3-argument version is still live
-- alongside the new 4-argument one. Two overloads of the same name is an
-- ambiguity risk for PostgREST's RPC dispatch (a 3-named-argument call from
-- the app could match either one), and the old version lacks the Delivered
-- exception and admin-override logic entirely, so it must go.

drop function if exists set_shopify_order_workflow_status(uuid, text, text);

-- Verification: expect exactly one row back, the 4-argument signature.
select p.oid::regprocedure as signature
from pg_proc p
where p.proname = 'set_shopify_order_workflow_status';
