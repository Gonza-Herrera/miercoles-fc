create function private.get_event_teams(p_event_id uuid)
returns table (
  team_id uuid,
  event_id uuid,
  team_name text,
  position integer,
  participant_id uuid,
  group_member_id uuid,
  display_name text,
  avatar_path text,
  is_guest boolean,
  football_response public.attendance_response,
  actual_football public.actual_attendance_status
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
    raise exception using errcode = '42501', message = 'TEAM_AUTH_REQUIRED';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_NOT_FOUND';
  end if;

  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'TEAM_ACCESS_DENIED';
  end if;

  return query
  select
    t.id as team_id,
    t.event_id,
    t.name as team_name,
    t.position,
    p.id as participant_id,
    p.group_member_id,
    coalesce(gm.display_name, p.guest_display_name, 'Jugador') as display_name,
    gm.avatar_url as avatar_path,
    p.group_member_id is null as is_guest,
    p.football_response,
    p.actual_football
  from public.teams as t
  join public.team_members as tm
    on tm.team_id = t.id and tm.event_id = t.event_id
  join public.event_participants as p
    on p.id = tm.event_participant_id and p.event_id = t.event_id
  left join public.group_members as gm
    on gm.id = p.group_member_id
  where t.event_id = target_event.id
  order by t.position, tm.created_at, display_name;
end;
$$;

create function public.get_event_teams(p_event_id uuid)
returns table (
  team_id uuid,
  event_id uuid,
  team_name text,
  position integer,
  participant_id uuid,
  group_member_id uuid,
  display_name text,
  avatar_path text,
  is_guest boolean,
  football_response public.attendance_response,
  actual_football public.actual_attendance_status
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_event_teams(p_event_id);
$$;

create function private.save_event_teams(
  p_event_id uuid,
  p_teams jsonb
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
  team_item jsonb;
  member_item jsonb;
  team_name text;
  team_pos integer;
  created_team_id uuid;
  target_participant_id uuid;
  target_group_member_id uuid;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'TEAM_AUTH_REQUIRED';
  end if;

  if p_teams is null or jsonb_typeof(p_teams) <> 'array' then
    raise exception using errcode = '22023', message = 'TEAM_LIST_INVALID';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'TEAM_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_CLOSED';
  end if;

  -- Borrar asignaciones existentes para este evento
  delete from public.team_members where event_id = target_event.id;
  delete from public.teams where event_id = target_event.id;

  for team_item in select * from jsonb_array_elements(p_teams)
  loop
    team_name := pg_catalog.btrim(team_item->>'name');
    team_pos := (team_item->>'position')::integer;

    if team_name is null or team_name = '' or team_pos is null or team_pos <= 0 then
      raise exception using errcode = '22023', message = 'TEAM_DATA_INVALID';
    end if;

    insert into public.teams (event_id, name, position)
    values (target_event.id, team_name, team_pos)
    returning id into created_team_id;

    if team_item->'members' is not null and jsonb_typeof(team_item->'members') = 'array' then
      for member_item in select * from jsonb_array_elements(team_item->'members')
      loop
        target_participant_id := nullif(member_item->>'participant_id', '')::uuid;
        target_group_member_id := nullif(member_item->>'group_member_id', '')::uuid;

        if target_participant_id is null and target_group_member_id is not null then
          insert into public.event_participants (event_id, group_member_id)
          values (target_event.id, target_group_member_id)
          on conflict (event_id, group_member_id)
          do update set updated_at = now()
          returning id into target_participant_id;
        end if;

        if target_participant_id is not null then
          insert into public.team_members (event_id, team_id, event_participant_id)
          values (target_event.id, created_team_id, target_participant_id);
        end if;
      end loop;
    end if;
  end loop;
end;
$$;

create function public.save_event_teams(
  p_event_id uuid,
  p_teams jsonb
)
returns void
language sql
volatile
set search_path = ''
as $$
  select private.save_event_teams(p_event_id, p_teams);
$$;

revoke all on function private.get_event_teams(uuid)
from public, anon, authenticated;
grant execute on function private.get_event_teams(uuid)
to authenticated;

revoke all on function public.get_event_teams(uuid)
from public, anon, authenticated;
grant execute on function public.get_event_teams(uuid)
to authenticated;

revoke all on function private.save_event_teams(uuid, jsonb)
from public, anon, authenticated;
grant execute on function private.save_event_teams(uuid, jsonb)
to authenticated;

revoke all on function public.save_event_teams(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.save_event_teams(uuid, jsonb)
to authenticated;
