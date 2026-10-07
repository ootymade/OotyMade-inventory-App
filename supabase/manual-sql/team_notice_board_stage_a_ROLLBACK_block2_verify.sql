-- ROLLBACK BLOCK 2 of 2 — verification only, run after rollback block 1.
-- Paste into its own tab and Run.
--
-- WHAT YOU SHOULD SEE: no rows at all (an empty result) — none of the
-- three tables exist anymore.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('team_notices', 'team_notice_seen', 'order_notes');
