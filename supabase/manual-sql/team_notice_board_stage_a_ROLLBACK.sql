-- team_notice_board_stage_a_ROLLBACK.sql — rollback for
-- team_notice_board_stage_a.sql.
--
-- WARNING — THIS IS DESTRUCTIVE, UNLIKE THE ANON-LOCKDOWN ROLLBACKS.
-- Those only restored a grant. This one deletes the tables themselves,
-- which deletes every announcement, every "seen by" record, and every
-- order note posted since Stage A went live. Only run this if Stage A
-- needs to be fully undone before real use — not as a casual undo.
--
-- Dropping the tables automatically removes them from the Realtime
-- publication and drops their policies with them — nothing extra to
-- clean up by hand.
-- ============================================================================

begin;

drop table if exists team_notice_seen;
drop table if exists order_notes;
drop table if exists team_notices;

commit;

select 'ROLLBACK STAGE A APPLIED' as status;

-- Verification — expect zero rows (none of the three tables exist anymore).
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('team_notices', 'team_notice_seen', 'order_notes');
