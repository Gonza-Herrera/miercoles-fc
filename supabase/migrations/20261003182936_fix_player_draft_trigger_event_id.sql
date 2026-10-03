create or replace function private.assert_no_active_player_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  if current_setting('app.lineup_swap', true) = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_table_name = 'events' then
    target_event_id := new.id;
  elsif tg_op = 'DELETE' then
    target_event_id := old.event_id;
  else
    target_event_id := new.event_id;
  end if;

  if exists (
    select 1
    from public.event_drafts as draft_row
    where draft_row.event_id = target_event_id
      and draft_row.status in (
        'IN_PROGRESS'::public.player_draft_status,
        'COMPLETED'::public.player_draft_status
      )
  ) then
    raise exception using errcode = 'P0001', message = 'DRAFT_CONFIGURATION_LOCKED';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.assert_no_active_player_draft()
from public, anon, authenticated;
