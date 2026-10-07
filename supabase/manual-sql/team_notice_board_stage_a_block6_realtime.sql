-- BLOCK 6 of 7 — turns on live refresh across phones for the three new
-- tables (the same mechanism every other screen in the app already
-- uses). Paste into its own tab and Run.
begin;

alter publication supabase_realtime add table team_notices, team_notice_seen, order_notes;

commit;

select 'BLOCK 6 APPLIED' as status;
