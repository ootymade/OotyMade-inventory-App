-- ROLLBACK BLOCK 1 of 2 — undoes every block above in one go: drops the
-- six functions and the three tables. Paste into its own tab and Run.
--
-- WARNING — THIS IS DESTRUCTIVE. It deletes every announcement, every
-- "seen by" record, and every order note posted since Stage A went
-- live, including hidden ones. Only run this if Stage A needs to be
-- fully undone before real use — not as a casual undo. Dropping the
-- tables automatically removes them from the Realtime publication and
-- drops their policies with them — nothing extra to clean up by hand.
begin;

drop function if exists set_notice_pinned(uuid, boolean);
drop function if exists edit_notice(uuid, text);
drop function if exists hide_notice(uuid, text);
drop function if exists unhide_notice(uuid);
drop function if exists hide_order_note(uuid, text);
drop function if exists unhide_order_note(uuid);

drop table if exists team_notice_seen;
drop table if exists order_notes;
drop table if exists team_notices;

commit;

select 'ROLLBACK BLOCK 1 APPLIED' as status;
