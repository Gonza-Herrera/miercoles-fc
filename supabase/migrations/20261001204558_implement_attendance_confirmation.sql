create function private.set_my_football_confirmation(
  p_event_id uuid,
  p_response public.attendance_response
)
returns public.event_participants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  caller_member_id uuid;
  saved_participant public.event_participants%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'ATTENDANCE_AUTH_REQUIRED';
  end if;

  if p_response is null or p_response = 'UNKNOWN'::public.attendance_response then
    raise exception using errcode = '22023', message = 'ATTENDANCE_RESPONSE_INVALID';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_FOUND';
  end if;

  if target_event.status <> 'OPEN'::public.event_status then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_OPEN';
  end if;

  select member.id
  into caller_member_id
  from public.group_members as member
  where member.group_id = target_event.group_id
    and member.profile_id = caller_profile_id
    and member.deactivated_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'ATTENDANCE_ACTIVE_MEMBER_REQUIRED';
  end if;

  insert into public.event_participants (
    event_id,
    group_member_id,
    football_response
  )
  values (
    target_event.id,
    caller_member_id,
    p_response
  )
  on conflict (event_id, group_member_id)
  do update set football_response = excluded.football_response
  returning * into saved_participant;

  return saved_participant;
end;
$$;

create function private.set_my_dinner_confirmation(
  p_event_id uuid,
  p_response public.attendance_response
)
returns public.event_participants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  caller_member_id uuid;
  saved_participant public.event_participants%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'ATTENDANCE_AUTH_REQUIRED';
  end if;

  if p_response is null or p_response = 'UNKNOWN'::public.attendance_response then
    raise exception using errcode = '22023', message = 'ATTENDANCE_RESPONSE_INVALID';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_FOUND';
  end if;

  if target_event.status <> 'OPEN'::public.event_status then
    raise exception using errcode = 'P0001', message = 'ATTENDANCE_EVENT_NOT_OPEN';
  end if;

  select member.id
  into caller_member_id
  from public.group_members as member
  where member.group_id = target_event.group_id
    and member.profile_id = caller_profile_id
    and member.deactivated_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'ATTENDANCE_ACTIVE_MEMBER_REQUIRED';
  end if;

  insert into public.event_participants (
    event_id,
    group_member_id,
    dinner_response
  )
  values (
    target_event.id,
    caller_member_id,
    p_response
  )
  on conflict (event_id, group_member_id)
  do update set dinner_response = excluded.dinner_response
  returning * into saved_participant;

  return saved_participant;
end;
$$;

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
  dinner_response public.attendance_response
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
      ) as dinner_response
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
      participant.dinner_response
    from public.event_participants as participant
    where participant.event_id = target_event.id
      and participant.group_member_id is null
      and participant.cancelled_at is null
  ) as attendance
  order by attendance.is_guest, attendance.display_name, attendance.participant_id;
end;
$$;

create function public.set_my_football_confirmation(
  p_event_id uuid,
  p_response public.attendance_response
)
returns public.event_participants
language sql
volatile
set search_path = ''
as $$
  select private.set_my_football_confirmation(p_event_id, p_response);
$$;

create function public.set_my_dinner_confirmation(
  p_event_id uuid,
  p_response public.attendance_response
)
returns public.event_participants
language sql
volatile
set search_path = ''
as $$
  select private.set_my_dinner_confirmation(p_event_id, p_response);
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
  dinner_response public.attendance_response
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_event_attendance(p_event_id);
$$;

revoke all on function private.set_my_football_confirmation(uuid, public.attendance_response)
from public, anon, authenticated;
revoke all on function private.set_my_dinner_confirmation(uuid, public.attendance_response)
from public, anon, authenticated;
revoke all on function private.get_event_attendance(uuid)
from public, anon, authenticated;

grant execute on function private.set_my_football_confirmation(uuid, public.attendance_response)
to authenticated;
grant execute on function private.set_my_dinner_confirmation(uuid, public.attendance_response)
to authenticated;
grant execute on function private.get_event_attendance(uuid)
to authenticated;

revoke all on function public.set_my_football_confirmation(uuid, public.attendance_response)
from public, anon, authenticated;
revoke all on function public.set_my_dinner_confirmation(uuid, public.attendance_response)
from public, anon, authenticated;
revoke all on function public.get_event_attendance(uuid)
from public, anon, authenticated;

grant execute on function public.set_my_football_confirmation(uuid, public.attendance_response)
to authenticated;
grant execute on function public.set_my_dinner_confirmation(uuid, public.attendance_response)
to authenticated;
grant execute on function public.get_event_attendance(uuid)
to authenticated;
