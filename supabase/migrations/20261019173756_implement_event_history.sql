create index events_closed_group_starts_at_id_idx
on public.events (group_id, starts_at desc, id desc)
where status = 'CLOSED'::public.event_status;

create function private.get_group_event_history(
  p_group_id uuid,
  p_before_starts_at timestamptz default null,
  p_before_event_id uuid default null,
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'HISTORY_AUTH_REQUIRED';
  end if;
  if p_group_id is null then
    raise exception using errcode = '22023', message = 'HISTORY_GROUP_INVALID';
  end if;
  if not private.is_group_member(p_group_id) then
    raise exception using errcode = '42501', message = 'HISTORY_ACCESS_DENIED';
  end if;
  if (p_before_starts_at is null) <> (p_before_event_id is null) then
    raise exception using errcode = '22023', message = 'HISTORY_CURSOR_INVALID';
  end if;

  return (
    with page as (
      select event_row.*
      from public.events as event_row
      where event_row.group_id = p_group_id
        and event_row.status = 'CLOSED'::public.event_status
        and (
          p_before_starts_at is null
          or (event_row.starts_at, event_row.id) < (p_before_starts_at, p_before_event_id)
        )
      order by event_row.starts_at desc, event_row.id desc
      limit normalized_limit + 1
    ), visible_page as (
      select page.* from page
      order by page.starts_at desc, page.id desc
      limit normalized_limit
    ), last_item as (
      select visible_page.starts_at, visible_page.id
      from visible_page
      order by visible_page.starts_at, visible_page.id
      limit 1
    )
    select jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'eventId', item.id,
          'groupId', item.group_id,
          'startsAt', item.starts_at,
          'title', item.title,
          'status', item.status,
          'closedAt', item.closed_at,
          'actualPlayerCount', (
            select count(*)
            from public.event_participants as participant
            where participant.event_id = item.id
              and participant.cancelled_at is null
              and participant.actual_football = 'YES'::public.actual_attendance_status
          ),
          'actualDinerCount', (
            select count(*)
            from public.event_participants as participant
            where participant.event_id = item.id
              and participant.cancelled_at is null
              and participant.actual_dinner = 'YES'::public.actual_attendance_status
          )
        ) order by item.starts_at desc, item.id desc)
        from visible_page as item
      ), '[]'::jsonb),
      'hasMore', (select count(*) > normalized_limit from page),
      'nextCursor', case when (select count(*) > normalized_limit from page) then (
        select jsonb_build_object('startsAt', last_item.starts_at, 'eventId', last_item.id)
        from last_item
      ) else null end
    )
  );
end;
$$;

create function public.get_group_event_history(
  p_group_id uuid,
  p_before_starts_at timestamptz default null,
  p_before_event_id uuid default null,
  p_limit integer default 10
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_group_event_history(
    p_group_id,
    p_before_starts_at,
    p_before_event_id,
    p_limit
  );
$$;

revoke all on function private.get_group_event_history(uuid, timestamptz, uuid, integer)
from public, anon, authenticated;
revoke all on function public.get_group_event_history(uuid, timestamptz, uuid, integer)
from public, anon;
grant execute on function private.get_group_event_history(uuid, timestamptz, uuid, integer)
to authenticated;
grant execute on function public.get_group_event_history(uuid, timestamptz, uuid, integer)
to authenticated;
