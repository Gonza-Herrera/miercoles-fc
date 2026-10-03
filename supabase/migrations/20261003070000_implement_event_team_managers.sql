create type public.team_formation_mode as enum ('RANDOM', 'MANAGERS');

alter table public.events
  add column team_formation_mode public.team_formation_mode not null default 'RANDOM';

create function private.assert_team_setup_write_allowed()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  target_status public.event_status;
begin
  select event_row.status
  into target_status
  from public.events as event_row
  where event_row.id = target_event_id;

  if target_status not in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_READ_ONLY';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function private.assert_random_team_member_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  target_mode public.team_formation_mode;
begin
  select event_row.team_formation_mode
  into target_mode
  from public.events as event_row
  where event_row.id = target_event_id;

  if target_mode <> 'RANDOM'::public.team_formation_mode then
    raise exception using errcode = 'P0001', message = 'TEAM_MODE_MANAGERS';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function private.remove_ineligible_event_manager()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deactivated_at is not null or new.profile_id is null then
    delete from public.event_managers as manager_row
    using public.events as event_row
    where manager_row.group_member_id = new.id
      and event_row.id = manager_row.event_id
      and event_row.status in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status);
  end if;
  return new;
end;
$$;

create function private.assert_event_manager_eligible()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_member public.group_members%rowtype;
begin
  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = new.event_id;

  if target_event.status not in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_READ_ONLY';
  end if;

  if target_event.team_formation_mode <> 'MANAGERS'::public.team_formation_mode then
    raise exception using errcode = 'P0001', message = 'TEAM_MODE_RANDOM';
  end if;

  select member_row.*
  into target_member
  from public.group_members as member_row
  where member_row.id = new.group_member_id;

  if not found or target_member.group_id <> target_event.group_id then
    raise exception using errcode = '23514', message = 'TEAM_MANAGER_GROUP_INVALID';
  end if;

  if target_member.deactivated_at is not null then
    raise exception using errcode = '23514', message = 'TEAM_MANAGER_INACTIVE';
  end if;

  if target_member.profile_id is null then
    raise exception using errcode = '23514', message = 'TEAM_MANAGER_ACCOUNT_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger teams_setup_write_guard
before insert or update or delete on public.teams
for each row execute function private.assert_team_setup_write_allowed();

create trigger team_members_random_mode_guard
before insert or update or delete on public.team_members
for each row execute function private.assert_random_team_member_write();

create trigger event_managers_eligibility_guard
before insert or update on public.event_managers
for each row execute function private.assert_event_manager_eligible();

create trigger group_members_manager_eligibility_cleanup
after update of deactivated_at, profile_id on public.group_members
for each row
when (
  old.deactivated_at is distinct from new.deactivated_at
  or old.profile_id is distinct from new.profile_id
)
execute function private.remove_ineligible_event_manager();

create function private.get_event_team_manager_configuration(p_event_id uuid)
returns table (
  formation_mode public.team_formation_mode,
  event_status public.event_status,
  team_id uuid,
  team_name text,
  team_position integer,
  manager_group_member_id uuid,
  manager_display_name text,
  manager_nickname text,
  manager_avatar_path text
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
    target_event.team_formation_mode,
    target_event.status,
    team_row.id,
    team_row.name,
    team_row.position,
    manager_row.group_member_id,
    member_row.display_name,
    member_row.nickname,
    member_row.avatar_url
  from (select 1) as anchor
  left join public.teams as team_row
    on team_row.event_id = target_event.id
  left join public.event_managers as manager_row
    on manager_row.event_id = target_event.id
    and manager_row.team_id = team_row.id
  left join public.group_members as member_row
    on member_row.id = manager_row.group_member_id
  order by team_row.position;
end;
$$;

create function public.get_event_team_manager_configuration(p_event_id uuid)
returns table (
  formation_mode public.team_formation_mode,
  event_status public.event_status,
  team_id uuid,
  team_name text,
  team_position integer,
  manager_group_member_id uuid,
  manager_display_name text,
  manager_nickname text,
  manager_avatar_path text
)
language sql
stable
set search_path = ''
as $$
  select * from private.get_event_team_manager_configuration(p_event_id);
$$;

create function private.set_event_team_formation_mode(
  p_event_id uuid,
  p_mode public.team_formation_mode,
  p_team_count integer default null
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
  target_position integer;
  team_names constant text[] := array['Equipo A', 'Equipo B', 'Equipo C'];
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'TEAM_AUTH_REQUIRED';
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

  if target_event.status not in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_READ_ONLY';
  end if;

  if p_mode is null then
    raise exception using errcode = '22023', message = 'TEAM_MODE_INVALID';
  end if;

  if p_mode = 'RANDOM'::public.team_formation_mode then
    if target_event.team_formation_mode = 'MANAGERS'::public.team_formation_mode then
      delete from public.event_managers where event_id = target_event.id;
      delete from public.team_members where event_id = target_event.id;
      delete from public.teams where event_id = target_event.id;
      update public.events
      set team_formation_mode = 'RANDOM'::public.team_formation_mode
      where id = target_event.id;
    end if;
    return;
  end if;

  if p_team_count not in (2, 3) then
    raise exception using errcode = '22023', message = 'TEAM_COUNT_INVALID';
  end if;

  if target_event.team_formation_mode = 'RANDOM'::public.team_formation_mode then
    delete from public.team_members where event_id = target_event.id;
    delete from public.event_managers where event_id = target_event.id;
    delete from public.teams where event_id = target_event.id;

    for target_position in 1..p_team_count loop
      insert into public.teams (event_id, name, position)
      values (target_event.id, team_names[target_position], target_position);
    end loop;

    update public.events
    set team_formation_mode = 'MANAGERS'::public.team_formation_mode
    where id = target_event.id;
    return;
  end if;

  delete from public.event_managers as manager_row
  where manager_row.event_id = target_event.id
    and exists (
      select 1
      from public.teams as team_row
      where team_row.id = manager_row.team_id
        and team_row.event_id = target_event.id
        and team_row.position > p_team_count
    );

  delete from public.teams
  where event_id = target_event.id
    and position > p_team_count;

  for target_position in 1..p_team_count loop
    insert into public.teams (event_id, name, position)
    values (target_event.id, team_names[target_position], target_position)
    on conflict (event_id, position) do nothing;
  end loop;
end;
$$;

create function public.set_event_team_formation_mode(
  p_event_id uuid,
  p_mode public.team_formation_mode,
  p_team_count integer default null
)
returns void
language sql
volatile
set search_path = ''
as $$
  select private.set_event_team_formation_mode(p_event_id, p_mode, p_team_count);
$$;

create function private.configure_event_team_managers(
  p_event_id uuid,
  p_assignments jsonb
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
  required_team_count integer;
  assignment_count integer;
  assignment_item jsonb;
  target_team_id uuid;
  target_group_member_id uuid;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'TEAM_AUTH_REQUIRED';
  end if;

  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'TEAM_MANAGER_LIST_INVALID';
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

  if target_event.status not in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'TEAM_EVENT_READ_ONLY';
  end if;

  if target_event.team_formation_mode <> 'MANAGERS'::public.team_formation_mode then
    raise exception using errcode = 'P0001', message = 'TEAM_MODE_RANDOM';
  end if;

  select count(*)::integer
  into required_team_count
  from public.teams as team_row
  where team_row.event_id = target_event.id;

  assignment_count := jsonb_array_length(p_assignments);
  if required_team_count not in (2, 3) or assignment_count <> required_team_count then
    raise exception using errcode = '22023', message = 'TEAM_MANAGERS_INCOMPLETE';
  end if;

  if (
    select count(distinct item->>'team_id') <> assignment_count
      or count(distinct item->>'group_member_id') <> assignment_count
    from jsonb_array_elements(p_assignments) as item
  ) then
    raise exception using errcode = '23505', message = 'TEAM_MANAGER_DUPLICATE';
  end if;

  for assignment_item in select * from jsonb_array_elements(p_assignments)
  loop
    begin
      target_team_id := (assignment_item->>'team_id')::uuid;
      target_group_member_id := (assignment_item->>'group_member_id')::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'TEAM_MANAGER_ASSIGNMENT_INVALID';
    end;

    if not exists (
      select 1
      from public.teams as team_row
      where team_row.id = target_team_id
        and team_row.event_id = target_event.id
    ) then
      raise exception using errcode = '23514', message = 'TEAM_MANAGER_TEAM_INVALID';
    end if;

    perform 1
    from public.group_members as member_row
    where member_row.id = target_group_member_id
      and member_row.group_id = target_event.group_id
      and member_row.deactivated_at is null
      and member_row.profile_id is not null
    for key share;

    if not found then
      raise exception using errcode = '23514', message = 'TEAM_MANAGER_MEMBER_INVALID';
    end if;
  end loop;

  delete from public.event_managers where event_id = target_event.id;

  insert into public.event_managers (event_id, team_id, group_member_id)
  select
    target_event.id,
    (item->>'team_id')::uuid,
    (item->>'group_member_id')::uuid
  from jsonb_array_elements(p_assignments) as item;
end;
$$;

create function public.configure_event_team_managers(
  p_event_id uuid,
  p_assignments jsonb
)
returns void
language sql
volatile
set search_path = ''
as $$
  select private.configure_event_team_managers(p_event_id, p_assignments);
$$;

revoke all on function private.assert_team_setup_write_allowed()
from public, anon, authenticated;
revoke all on function private.assert_random_team_member_write()
from public, anon, authenticated;
revoke all on function private.assert_event_manager_eligible()
from public, anon, authenticated;
revoke all on function private.remove_ineligible_event_manager()
from public, anon, authenticated;

revoke all on function private.get_event_team_manager_configuration(uuid)
from public, anon, authenticated;
grant execute on function private.get_event_team_manager_configuration(uuid)
to authenticated;
revoke all on function public.get_event_team_manager_configuration(uuid)
from public, anon, authenticated;
grant execute on function public.get_event_team_manager_configuration(uuid)
to authenticated;

revoke all on function private.set_event_team_formation_mode(uuid, public.team_formation_mode, integer)
from public, anon, authenticated;
grant execute on function private.set_event_team_formation_mode(uuid, public.team_formation_mode, integer)
to authenticated;
revoke all on function public.set_event_team_formation_mode(uuid, public.team_formation_mode, integer)
from public, anon, authenticated;
grant execute on function public.set_event_team_formation_mode(uuid, public.team_formation_mode, integer)
to authenticated;

revoke all on function private.configure_event_team_managers(uuid, jsonb)
from public, anon, authenticated;
grant execute on function private.configure_event_team_managers(uuid, jsonb)
to authenticated;
revoke all on function public.configure_event_team_managers(uuid, jsonb)
from public, anon, authenticated;
grant execute on function public.configure_event_team_managers(uuid, jsonb)
to authenticated;
