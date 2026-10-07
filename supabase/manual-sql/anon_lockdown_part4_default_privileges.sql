-- anon_lockdown_part4_default_privileges.sql — written 2026-10-07, based on
-- commit 1906dfcee0f9129f79a4941c4faac4c4b18e426d. Check `git log` on this
-- path for the commit that actually matters when comparing against GitHub.
--
-- PART 4 of 5 — DEFAULT PRIVILEGES FOR FUTURE OBJECTS. Independently
-- runnable: does not need part 1, 2, 3 or 5. Zero effect on anything
-- that already exists or on the app's current behavior — there is
-- nothing to test on your phone after this one. It only changes what
-- privileges a brand-new table/sequence/function gets automatically
-- the next time one is created in this project.
--
-- What it does: `postgres` (the role this SQL Editor runs as, and the
-- owner of every object in this project so far) has a standing default
-- that hands anon full CRUD/EXECUTE on anything new — that's the
-- Supabase project-template default, and it's what quietly gave every
-- table created this session a raw anon grant even though RLS blocked
-- the actual data. This cancels that default going forward.
--
-- supabase_admin has the same standing default in principle, but
-- `postgres` cannot alter supabase_admin's defaults — confirmed
-- directly: it is not a superuser and not a member of that role. The
-- block below attempts it anyway and catches the expected
-- "permission denied" cleanly rather than erroring the whole script —
-- harmless either way, since nothing in this project is ever created
-- as supabase_admin.
-- ============================================================================

begin;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on functions from public;

do $$
begin
  alter default privileges for role supabase_admin in schema public revoke all on tables from anon;
  alter default privileges for role supabase_admin in schema public revoke all on sequences from anon;
  alter default privileges for role supabase_admin in schema public revoke all on functions from anon;
  alter default privileges for role supabase_admin in schema public revoke all on functions from public;
exception when insufficient_privilege then
  raise notice 'Skipped supabase_admin defaults — this role cannot alter them (expected; harmless, see comment above)';
end $$;

commit;

select 'PART 4 APPLIED' as status;

-- ============================================================================
-- VERIFICATION — run right after. Expect:
--   - The `postgres` row's defaclacl for objtype r/S/f should no longer
--     list "anon=..." (tables/sequences) or "anon=...,...public=..."
--     (functions).
--   - The `supabase_admin` row's defaclacl is EXPECTED to be unchanged
--     (still lists anon) — that's the part this role can't touch, by
--     design, not a sign this part failed.
-- ============================================================================

select d.defaclrole::regrole as role, d.defaclobjtype as objtype, d.defaclacl
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
order by role, objtype;
