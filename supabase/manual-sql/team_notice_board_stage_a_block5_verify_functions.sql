-- BLOCK 5 of 7 — verification only, run after block 4. Paste into its
-- own tab and Run.
--
-- WHAT YOU SHOULD SEE: six rows (one per function). Every row's
-- anon_exec and public_exec should read "false", and authenticated_exec
-- should read "true".
select p.proname,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_notice_pinned', 'edit_notice', 'hide_notice', 'unhide_notice', 'hide_order_note', 'unhide_order_note')
order by p.proname;
