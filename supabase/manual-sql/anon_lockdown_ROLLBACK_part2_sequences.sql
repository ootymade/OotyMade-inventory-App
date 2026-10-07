-- anon_lockdown_ROLLBACK_part2_sequences.sql — rollback for
-- anon_lockdown_part2_sequences.sql. Independent of the other rollback
-- parts.
--
-- Restores exactly what part 2 removed: anon held SELECT, UPDATE, USAGE
-- (= ALL for a sequence) on gst_invoice_number_seq. No PUBLIC-pseudo-role
-- grant to restore.
-- ============================================================================

begin;

grant all privileges on sequence gst_invoice_number_seq to anon;

commit;

select 'ROLLBACK PART 2 APPLIED' as status;

-- Verification — expect true (matches pre-lockdown state).
select has_sequence_privilege('anon', 'public.gst_invoice_number_seq', 'USAGE') as anon_usage;
