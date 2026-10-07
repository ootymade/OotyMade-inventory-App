-- BLOCK 4 of 7 — creates the six functions admins use to pin, edit,
-- hide and unhide. Every one checks team_members.role = 'admin' for
-- itself before doing anything — a staff account calling one of these
-- directly gets "Admin only", not just a hidden button in the app.
-- Paste this whole file into its own tab and Run.
--
-- Hiding is a soft action: the row stays (hidden_at/hidden_by/
-- hidden_reason recorded, the audit trail block 1's RLS policy relies
-- on), it just stops being returned to anyone who isn't an admin.
begin;

create or replace function set_notice_pinned(p_notice_id uuid, p_pinned boolean)
returns team_notices
language plpgsql security definer set search_path to 'public'
as $$
declare v team_notices;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  update team_notices
    set pinned = p_pinned,
        pinned_at = case when p_pinned then now() else null end,
        pinned_by = case when p_pinned then (select auth.uid()) else null end,
        updated_at = now()
    where id = p_notice_id
    returning * into v;
  if not found then raise exception 'Notice not found'; end if;
  return v;
end;
$$;

create or replace function edit_notice(p_notice_id uuid, p_body text)
returns team_notices
language plpgsql security definer set search_path to 'public'
as $$
declare v team_notices;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Announcement text is required';
  end if;
  update team_notices
    set body = btrim(p_body), edited_at = now(), updated_at = now()
    where id = p_notice_id and hidden_at is null
    returning * into v;
  if not found then raise exception 'Notice not found or hidden'; end if;
  return v;
end;
$$;

create or replace function hide_notice(p_notice_id uuid, p_reason text)
returns team_notices
language plpgsql security definer set search_path to 'public'
as $$
declare v team_notices;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required to hide a notice';
  end if;
  update team_notices
    set hidden_at = now(), hidden_by = (select auth.uid()), hidden_reason = btrim(p_reason)
    where id = p_notice_id
    returning * into v;
  if not found then raise exception 'Notice not found'; end if;
  return v;
end;
$$;

create or replace function unhide_notice(p_notice_id uuid)
returns team_notices
language plpgsql security definer set search_path to 'public'
as $$
declare v team_notices;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  update team_notices
    set hidden_at = null, hidden_by = null, hidden_reason = null
    where id = p_notice_id
    returning * into v;
  if not found then raise exception 'Notice not found'; end if;
  return v;
end;
$$;

create or replace function hide_order_note(p_note_id uuid, p_reason text)
returns order_notes
language plpgsql security definer set search_path to 'public'
as $$
declare v order_notes;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required to hide a note';
  end if;
  update order_notes
    set hidden_at = now(), hidden_by = (select auth.uid()), hidden_reason = btrim(p_reason)
    where id = p_note_id
    returning * into v;
  if not found then raise exception 'Note not found'; end if;
  return v;
end;
$$;

create or replace function unhide_order_note(p_note_id uuid)
returns order_notes
language plpgsql security definer set search_path to 'public'
as $$
declare v order_notes;
begin
  if not exists (select 1 from team_members where id = (select auth.uid()) and role = 'admin') then
    raise exception 'Admin only';
  end if;
  update order_notes
    set hidden_at = null, hidden_by = null, hidden_reason = null
    where id = p_note_id
    returning * into v;
  if not found then raise exception 'Note not found'; end if;
  return v;
end;
$$;

revoke all on function
  set_notice_pinned(uuid, boolean), edit_notice(uuid, text), hide_notice(uuid, text), unhide_notice(uuid),
  hide_order_note(uuid, text), unhide_order_note(uuid)
  from anon, public;
grant execute on function
  set_notice_pinned(uuid, boolean), edit_notice(uuid, text), hide_notice(uuid, text), unhide_notice(uuid),
  hide_order_note(uuid, text), unhide_order_note(uuid)
  to authenticated;

commit;

select 'BLOCK 4 APPLIED' as status;
