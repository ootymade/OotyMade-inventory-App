-- BLOCK 2 of 7 — verification only, run after block 1. Paste into its
-- own tab and Run.
--
-- WHAT YOU SHOULD SEE: no rows at all (an empty result). That means
-- anon and PUBLIC have nothing on any of the three new tables.
select table_name, privilege_type, grantee
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('team_notices', 'team_notice_seen', 'order_notes')
  and grantee in ('anon', 'public');
