-- BLOCK 7 of 7 — verification only, run after block 6. Paste into its
-- own tab and Run.
--
-- WHAT YOU SHOULD SEE: three rows — team_notices, team_notice_seen,
-- order_notes.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('team_notices', 'team_notice_seen', 'order_notes');
