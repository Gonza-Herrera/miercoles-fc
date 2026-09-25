alter table public.event_participants
add column created_by uuid references public.profiles (id) on delete restrict,
add column cancelled_at timestamptz;

alter table public.event_participants
add constraint event_participants_guest_name_length check (
  guest_display_name is null or char_length(btrim(guest_display_name)) <= 100
),
add constraint event_participants_guest_has_activity check (
  group_member_id is not null
  or football_response = 'YES'::public.attendance_response
  or dinner_response = 'YES'::public.attendance_response
),
add constraint event_participants_guest_has_creator check (
  group_member_id is not null or created_by is not null
),
add constraint event_participants_cancelled_after_creation check (
  cancelled_at is null or cancelled_at >= created_at
);

create index event_participants_created_by_idx
on public.event_participants (created_by)
where created_by is not null;

create index event_participants_active_event_idx
on public.event_participants (event_id)
where cancelled_at is null;

create function private.add_guest_participant(
  p_event_id uuid,
  p_display_name text,
  p_plays boolean,
  p_dines boolean
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
  normalized_name text := pg_catalog.btrim(p_display_name);
  created_participant public.event_participants%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'GUEST_AUTH_REQUIRED';
  end if;

  if p_plays is null or p_dines is null then
    raise exception using errcode = '22023', message = 'GUEST_PARTICIPATION_INVALID';
  end if;

  if not p_plays and not p_dines then
    raise exception using errcode = '22023', message = 'GUEST_ACTIVITY_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'GUEST_NAME_INVALID';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'GUEST_EVENT_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'GUEST_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'GUEST_EVENT_CLOSED';
  end if;

  insert into public.event_participants (
    event_id,
    guest_display_name,
    football_response,
    dinner_response,
    created_by
  )
  values (
    target_event.id,
    normalized_name,
    case when p_plays then 'YES' else 'NO' end::public.attendance_response,
    case when p_dines then 'YES' else 'NO' end::public.attendance_response,
    caller_profile_id
  )
  returning * into created_participant;

  return created_participant;
end;
$$;

create function private.update_guest_participant(
  p_event_participant_id uuid,
  p_display_name text,
  p_plays boolean,
  p_dines boolean
)
returns public.event_participants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_participant public.event_participants%rowtype;
  target_event public.events%rowtype;
  normalized_name text := pg_catalog.btrim(p_display_name);
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'GUEST_AUTH_REQUIRED';
  end if;

  if p_plays is null or p_dines is null then
    raise exception using errcode = '22023', message = 'GUEST_PARTICIPATION_INVALID';
  end if;

  if not p_plays and not p_dines then
    raise exception using errcode = '22023', message = 'GUEST_ACTIVITY_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'GUEST_NAME_INVALID';
  end if;

  select participant.*
  into target_participant
  from public.event_participants as participant
  where participant.id = p_event_participant_id
  for update;

  if not found or target_participant.group_member_id is not null then
    raise exception using errcode = 'P0001', message = 'GUEST_NOT_FOUND';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = target_participant.event_id
  for update;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'GUEST_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'GUEST_EVENT_CLOSED';
  end if;

  if target_participant.cancelled_at is not null then
    raise exception using errcode = 'P0001', message = 'GUEST_CANCELLED';
  end if;

  update public.event_participants as participant
  set
    guest_display_name = normalized_name,
    football_response = case when p_plays then 'YES' else 'NO' end::public.attendance_response,
    dinner_response = case when p_dines then 'YES' else 'NO' end::public.attendance_response
  where participant.id = target_participant.id
  returning participant.* into target_participant;

  return target_participant;
end;
$$;

create function private.cancel_guest_participant(p_event_participant_id uuid)
returns public.event_participants
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_participant public.event_participants%rowtype;
  target_event public.events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'GUEST_AUTH_REQUIRED';
  end if;

  select participant.*
  into target_participant
  from public.event_participants as participant
  where participant.id = p_event_participant_id
  for update;

  if not found or target_participant.group_member_id is not null then
    raise exception using errcode = 'P0001', message = 'GUEST_NOT_FOUND';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = target_participant.event_id
  for update;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'GUEST_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'GUEST_EVENT_CLOSED';
  end if;

  if target_participant.cancelled_at is null then
    update public.event_participants as participant
    set cancelled_at = pg_catalog.statement_timestamp()
    where participant.id = target_participant.id
    returning participant.* into target_participant;
  end if;

  return target_participant;
end;
$$;

create function public.add_guest_participant(
  p_event_id uuid,
  p_display_name text,
  p_plays boolean,
  p_dines boolean
)
returns table (
  id uuid,
  event_id uuid,
  group_member_id uuid,
  guest_display_name text,
  football_response public.attendance_response,
  dinner_response public.attendance_response,
  actual_football public.actual_attendance_status,
  actual_dinner public.actual_attendance_status,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
set search_path = ''
as $$
  select
    participant.id,
    participant.event_id,
    participant.group_member_id,
    participant.guest_display_name,
    participant.football_response,
    participant.dinner_response,
    participant.actual_football,
    participant.actual_dinner,
    participant.cancelled_at,
    participant.created_at,
    participant.updated_at
  from private.add_guest_participant(p_event_id, p_display_name, p_plays, p_dines) as participant;
$$;

create function public.update_guest_participant(
  p_event_participant_id uuid,
  p_display_name text,
  p_plays boolean,
  p_dines boolean
)
returns table (
  id uuid,
  event_id uuid,
  group_member_id uuid,
  guest_display_name text,
  football_response public.attendance_response,
  dinner_response public.attendance_response,
  actual_football public.actual_attendance_status,
  actual_dinner public.actual_attendance_status,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
set search_path = ''
as $$
  select
    participant.id,
    participant.event_id,
    participant.group_member_id,
    participant.guest_display_name,
    participant.football_response,
    participant.dinner_response,
    participant.actual_football,
    participant.actual_dinner,
    participant.cancelled_at,
    participant.created_at,
    participant.updated_at
  from private.update_guest_participant(
    p_event_participant_id,
    p_display_name,
    p_plays,
    p_dines
  ) as participant;
$$;

create function public.cancel_guest_participant(p_event_participant_id uuid)
returns table (
  id uuid,
  event_id uuid,
  group_member_id uuid,
  guest_display_name text,
  football_response public.attendance_response,
  dinner_response public.attendance_response,
  actual_football public.actual_attendance_status,
  actual_dinner public.actual_attendance_status,
  cancelled_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
set search_path = ''
as $$
  select
    participant.id,
    participant.event_id,
    participant.group_member_id,
    participant.guest_display_name,
    participant.football_response,
    participant.dinner_response,
    participant.actual_football,
    participant.actual_dinner,
    participant.cancelled_at,
    participant.created_at,
    participant.updated_at
  from private.cancel_guest_participant(p_event_participant_id) as participant;
$$;

revoke all on function private.add_guest_participant(uuid, text, boolean, boolean)
from public, anon, authenticated;
revoke all on function private.update_guest_participant(uuid, text, boolean, boolean)
from public, anon, authenticated;
revoke all on function private.cancel_guest_participant(uuid)
from public, anon, authenticated;

grant execute on function private.add_guest_participant(uuid, text, boolean, boolean)
to authenticated;
grant execute on function private.update_guest_participant(uuid, text, boolean, boolean)
to authenticated;
grant execute on function private.cancel_guest_participant(uuid)
to authenticated;

revoke all on function public.add_guest_participant(uuid, text, boolean, boolean)
from public, anon, authenticated;
revoke all on function public.update_guest_participant(uuid, text, boolean, boolean)
from public, anon, authenticated;
revoke all on function public.cancel_guest_participant(uuid)
from public, anon, authenticated;

grant execute on function public.add_guest_participant(uuid, text, boolean, boolean)
to authenticated;
grant execute on function public.update_guest_participant(uuid, text, boolean, boolean)
to authenticated;
grant execute on function public.cancel_guest_participant(uuid)
to authenticated;
