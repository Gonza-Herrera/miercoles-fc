drop function if exists public.get_event_attendance(uuid);
drop function if exists private.get_event_attendance(uuid);

create function private.get_event_attendance(p_event_id uuid)
returns table (
  participant_id uuid,
  event_id uuid,
  group_member_id uuid,
  display_name text,
  avatar_path text,
  is_guest boolean,
  is_current_user boolean,
  membership_active boolean,
  football_response public.attendance_response,
  dinner_response public.attendance_response,
  actual_football public.actual_attendance_status,
  actual_dinner public.actual_attendance_status
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'ATTENDANCE_AUTH_REQUIRED';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_FOUND';
  end if;

  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'ATTENDANCE_ACCESS_DENIED';
  end if;

  return query
  select attendance.*
  from (
    select
      participant.id as participant_id,
      target_event.id as event_id,
      member.id as group_member_id,
      member.display_name,
      member.avatar_url as avatar_path,
      false as is_guest,
      member.profile_id = caller_profile_id as is_current_user,
      member.deactivated_at is null as membership_active,
      coalesce(
        participant.football_response,
        'UNKNOWN'::public.attendance_response
      ) as football_response,
      coalesce(
        participant.dinner_response,
        'UNKNOWN'::public.attendance_response
      ) as dinner_response,
      coalesce(
        participant.actual_football,
        'UNSET'::public.actual_attendance_status
      ) as actual_football,
      coalesce(
        participant.actual_dinner,
        'UNSET'::public.actual_attendance_status
      ) as actual_dinner
    from public.group_members as member
    left join public.event_participants as participant
      on participant.event_id = target_event.id
      and participant.group_member_id = member.id
    where member.group_id = target_event.group_id
      and (member.deactivated_at is null or participant.id is not null)

    union all

    select
      participant.id as participant_id,
      participant.event_id,
      null::uuid as group_member_id,
      participant.guest_display_name as display_name,
      null::text as avatar_path,
      true as is_guest,
      false as is_current_user,
      true as membership_active,
      participant.football_response,
      participant.dinner_response,
      participant.actual_football,
      participant.actual_dinner
    from public.event_participants as participant
    where participant.event_id = target_event.id
      and participant.group_member_id is null
      and participant.cancelled_at is null
  ) as attendance
  order by attendance.is_guest, attendance.display_name, attendance.participant_id;
end;
$$;

create function public.get_event_attendance(p_event_id uuid)
returns table (
  participant_id uuid,
  event_id uuid,
  group_member_id uuid,
  display_name text,
  avatar_path text,
  is_guest boolean,
  is_current_user boolean,
  membership_active boolean,
  football_response public.attendance_response,
  dinner_response public.attendance_response,
  actual_football public.actual_attendance_status,
  actual_dinner public.actual_attendance_status
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_event_attendance(p_event_id);
$$;

create function private.record_match_attendance(
  p_event_id uuid,
  p_attendances jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  item jsonb;
  item_group_member_id uuid;
  item_participant_id uuid;
  item_attended boolean;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'ATTENDANCE_AUTH_REQUIRED';
  end if;

  if p_attendances is null or jsonb_typeof(p_attendances) <> 'array' then
    raise exception using errcode = '22023', message = 'ATTENDANCE_LIST_INVALID';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'ATTENDANCE_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_CLOSED';
  end if;

  for item in select * from jsonb_array_elements(p_attendances)
  loop
    item_group_member_id := nullif(item->>'group_member_id', '')::uuid;
    item_participant_id := nullif(item->>'participant_id', '')::uuid;
    item_attended := coalesce((item->>'attended')::boolean, false);

    if item_participant_id is not null then
      update public.event_participants
      set actual_football = case when item_attended then 'YES' else 'NO' end::public.actual_attendance_status
      where id = item_participant_id
        and event_id = target_event.id;
    elsif item_group_member_id is not null then
      insert into public.event_participants (
        event_id,
        group_member_id,
        actual_football
      )
      values (
        target_event.id,
        item_group_member_id,
        case when item_attended then 'YES' else 'NO' end::public.actual_attendance_status
      )
      on conflict (event_id, group_member_id)
      do update set actual_football = excluded.actual_football;
    end if;
  end loop;
end;
$$;

create function public.record_match_attendance(
  p_event_id uuid,
  p_attendances jsonb
)
returns void
language sql
volatile
set search_path = ''
as $$
  select private.record_match_attendance(p_event_id, p_attendances);
$$;

revoke all on function private.get_event_attendance(uuid)
from public, anon, authenticated;
grant execute on function private.get_event_attendance(uuid)
to authenticated;

revoke all on function public.get_event_attendance(uuid)
from public, anon, authenticated;
grant execute on function public.get_event_attendance(uuid)
to authenticated;

revoke all on function private.record_match_attendance(uuid, jsonb)
from public, anon, authenticated;
grant execute on function private.record_match_attendance(uuid, jsonb)
to authenticated;

revoke all on function public.record_match_attendance(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.record_match_attendance(uuid, jsonb)
to authenticated;
