-- anon_lockdown_ROLLBACK_part4_default_privileges.sql — rollback for
-- anon_lockdown_part4_default_privileges.sql. Independent of the other
-- rollback parts. No live object or current app behavior is affected by
-- this either way — same as part 4 itself, nothing to test on your phone.
--
-- Restores postgres's exact standing defaults from before part 4 (ALL on
-- tables and sequences, EXECUTE on functions, all to anon). The
-- supabase_admin lines are attempted and skipped the same way part 4
-- skipped them — postgres cannot alter supabase_admin's defaults either
-- direction, so there is nothing this rollback can or needs to do there.
-- ============================================================================

begin;

alter default privileges for role postgres in schema public grant all on tables to anon;
alter default privileges for role postgres in schema public grant all on sequences to anon;
alter default privileges for role postgres in schema public grant execute on functions to anon;

do $$
begin
  alter default privileges for role supabase_admin in schema public grant all on tables to anon;
  alter default privileges for role supabase_admin in schema public grant all on sequences to anon;
  alter default privileges for role supabase_admin in schema public grant execute on functions to anon;
exception when insufficient_privilege then
  raise notice 'Skipped supabase_admin defaults — this role cannot alter them (expected; harmless, see comment above)';
end $$;

commit;

select 'ROLLBACK PART 4 APPLIED' as status;

-- Verification — expect the postgres row's defaclacl to list anon=... again.
select d.defaclrole::regrole as role, d.defaclobjtype as objtype, d.defaclacl
from pg_default_acl d
join pg_namespace n on n.oid = d.defaclnamespace
where n.nspname = 'public'
order by role, objtype;
