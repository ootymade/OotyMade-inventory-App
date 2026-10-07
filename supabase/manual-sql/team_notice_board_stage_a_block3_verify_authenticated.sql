-- BLOCK 3 of 7 — verification only, run after block 1. Paste into its
-- own tab and Run.
--
-- WHAT YOU SHOULD SEE: one row, with every column reading "true" EXCEPT
-- the three columns ending in _delete_should_be_false and the three
-- ending in _update_should_be_false (those should read "false").
select
  has_table_privilege('authenticated', 'public.team_notices', 'SELECT') as notices_select,
  has_table_privilege('authenticated', 'public.team_notices', 'INSERT') as notices_insert,
  has_table_privilege('authenticated', 'public.team_notices', 'UPDATE') as notices_update_should_be_false,
  has_table_privilege('authenticated', 'public.team_notices', 'DELETE') as notices_delete_should_be_false,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'SELECT') as seen_select,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'INSERT') as seen_insert,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'UPDATE') as seen_update_should_be_false,
  has_table_privilege('authenticated', 'public.team_notice_seen', 'DELETE') as seen_delete_should_be_false,
  has_table_privilege('authenticated', 'public.order_notes', 'SELECT') as order_notes_select,
  has_table_privilege('authenticated', 'public.order_notes', 'INSERT') as order_notes_insert,
  has_table_privilege('authenticated', 'public.order_notes', 'UPDATE') as order_notes_update_should_be_false,
  has_table_privilege('authenticated', 'public.order_notes', 'DELETE') as order_notes_delete_should_be_false;
