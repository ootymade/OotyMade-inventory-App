-- anon_lockdown_part2_sequences.sql — written 2026-10-07, based on commit
-- 1906dfcee0f9129f79a4941c4faac4c4b18e426d. Check `git log` on this path
-- for the commit that actually matters when comparing against GitHub.
--
-- PART 2 of 5 — SEQUENCES ONLY. Independently runnable: does not need
-- part 1, 3, 4 or 5. Lowest-risk of all five parts — nothing in the app
-- calls into this sequence as the `authenticated` role at all; the one
-- place it's used (confirm_direct_order, generating a GST invoice
-- number) is a SECURITY DEFINER function that runs with the function
-- owner's rights, not the caller's, so this sequence's grants to
-- authenticated were never actually exercised by the app either way.
--
-- What it does: revokes SELECT/UPDATE/USAGE on gst_invoice_number_seq
-- (the only sequence in public with any anon/PUBLIC grant) from anon
-- and PUBLIC. `authenticated` is never named, so untouched regardless.
-- ============================================================================

begin;

revoke all privileges on all sequences in schema public from anon, public;

commit;

select 'PART 2 APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - anon_usage: false
--   - auth_usage: true (unaffected)
-- ============================================================================

select
  has_sequence_privilege('anon', 'public.gst_invoice_number_seq', 'USAGE') as anon_usage,
  has_sequence_privilege('authenticated', 'public.gst_invoice_number_seq', 'USAGE') as auth_usage;
