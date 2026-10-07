-- anon_lockdown_ROLLBACK_part5_recreate_http_extension.sql — rollback for
-- anon_lockdown_part5_drop_http_extension.sql. Independent of the other
-- rollback parts.
--
-- Recreates the http extension, then explicitly restores EXECUTE to
-- both anon and PUBLIC on every one of its 20 function signatures —
-- CREATE EXTENSION alone does not guarantee the exact same grants it
-- had before, so this re-asserts them rather than assuming. Looped and
-- exception-guarded so a missing function is skipped, not fatal.
-- ============================================================================

begin;

do $$
begin
  create extension if not exists http;
exception when others then
  raise notice 'Could not recreate the http extension: %. The grants below will just be skipped.', sqlerrm;
end $$;

do $$
declare
  sig text;
  sigs text[] := array[
    'public.bytea_to_text(bytea)',
    'public.http(public.http_request)',
    'public.http_delete(character varying)',
    'public.http_delete(character varying, character varying, character varying)',
    'public.http_get(character varying, jsonb)',
    'public.http_get(character varying)',
    'public.http_head(character varying)',
    'public.http_header(character varying, character varying)',
    'public.http_list_curlopt()',
    'public.http_patch(character varying, character varying, character varying)',
    'public.http_post(character varying, jsonb)',
    'public.http_post(character varying, character varying, character varying)',
    'public.http_put(character varying, character varying, character varying)',
    'public.http_reset_curlopt()',
    'public.http_set_curlopt(character varying, character varying)',
    'public.text_to_bytea(text)',
    'public.urlencode(character varying)',
    'public.urlencode(jsonb)',
    'public.urlencode(bytea)'
  ];
begin
  foreach sig in array sigs loop
    begin
      execute format('grant execute on function %s to anon, public', sig);
    exception when undefined_function then
      raise notice 'Skipped % — function does not exist', sig;
    end;
  end loop;
end $$;

commit;

select 'ROLLBACK PART 5 APPLIED' as status;

-- Verification — expect true for both.
select
  exists(select 1 from pg_extension where extname = 'http') as extension_present,
  has_function_privilege('anon', 'public.http_get(character varying)', 'EXECUTE') as anon_http_get_exec;
