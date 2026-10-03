create type public.player_draft_status as enum ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

create table public.event_drafts (
  event_id uuid primary key references public.events (id) on delete restrict,
  status public.player_draft_status not null default 'NOT_STARTED',
  current_team_id uuid,
  team_capacities integer[] not null,
  pick_number integer not null default 0 check (pick_number >= 0),
  version bigint not null default 1 check (version > 0),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint event_drafts_current_team_fk
    foreign key (current_team_id, event_id)
    references public.teams (id, event_id)
    on delete restrict,
  constraint event_drafts_capacities_valid check (
    cardinality(team_capacities) in (2, 3)
    and 0 < all(team_capacities)
  ),
  constraint event_drafts_state_valid check (
    (status = 'NOT_STARTED' and current_team_id is null and started_at is null and completed_at is null)
    or
    (status = 'IN_PROGRESS' and current_team_id is not null and started_at is not null and completed_at is null)
    or
    (status = 'COMPLETED' and current_team_id is null and started_at is not null and completed_at is not null)
  )
);

create index event_drafts_current_team_id_idx
  on public.event_drafts (current_team_id)
  where current_team_id is not null;

create trigger event_drafts_set_updated_at
before update on public.event_drafts
for each row execute function private.set_updated_at();

-- PR16 protects MANAGERS rosters from the random-team write path. PR17 owns those
-- writes once a draft row exists; authenticated clients still have no table write grants.
create or replace function private.assert_random_team_member_write()
returns trigger
language plpgsql
security definer
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

  if target_mode = 'MANAGERS'::public.team_formation_mode
    and not exists (
      select 1
      from public.event_drafts as draft_row
      where draft_row.event_id = target_event_id
    )
  then
    raise exception using errcode = 'P0001', message = 'TEAM_MODE_MANAGERS';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function private.team_capacities_for_player_count(player_count integer)
returns integer[]
language plpgsql
immutable
set search_path = ''
as $$
begin
  if player_count < 2 then
    raise exception using errcode = '22023', message = 'DRAFT_INSUFFICIENT_PLAYERS';
  end if;
  if player_count < 10 then
    return array[player_count / 2, player_count - (player_count / 2)];
  end if;
  if player_count = 10 then return array[5, 5]; end if;
  if player_count = 11 then return array[5, 6]; end if;
  if player_count = 12 then return array[6, 6]; end if;
  return array[5, 5, player_count - 10];
end;
$$;

create function private.next_draft_team(
  p_event_id uuid,
  p_after_position integer,
  p_capacities integer[]
)
returns uuid
language sql
stable
set search_path = ''
as $$
  select team_row.id
  from public.teams as team_row
  join public.event_managers as manager_row
    on manager_row.event_id = team_row.event_id
    and manager_row.team_id = team_row.id
  where team_row.event_id = p_event_id
    and team_row.position between 1 and cardinality(p_capacities)
    and (
      select count(*)
      from public.team_members as roster
      where roster.event_id = team_row.event_id
        and roster.team_id = team_row.id
    ) < p_capacities[team_row.position]
  order by
    case when team_row.position > p_after_position then 0 else 1 end,
    team_row.position
  limit 1;
$$;

create function private.assert_no_active_player_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  target_event_id := case tg_table_name
    when 'events' then coalesce(new.id, old.id)
    else coalesce(new.event_id, old.event_id)
  end;

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

create function private.assert_draft_attendance_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  affects_football boolean := false;
begin
  if tg_op = 'INSERT' then
    affects_football := new.actual_football = 'YES'::public.actual_attendance_status;
  elsif tg_op = 'DELETE' then
    affects_football := old.actual_football = 'YES'::public.actual_attendance_status;
  else
    affects_football := new.actual_football is distinct from old.actual_football
      or new.cancelled_at is distinct from old.cancelled_at;
  end if;

  if affects_football and exists (
    select 1
    from public.event_drafts as draft_row
    where draft_row.event_id = target_event_id
      and draft_row.status in (
        'IN_PROGRESS'::public.player_draft_status,
        'COMPLETED'::public.player_draft_status
      )
  ) then
    raise exception using errcode = 'P0001', message = 'DRAFT_ATTENDANCE_LOCKED';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function private.assert_draft_event_transition_allowed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.event_drafts as draft_row
    where draft_row.event_id = new.id
      and draft_row.status = 'IN_PROGRESS'::public.player_draft_status
  ) then
    raise exception using errcode = 'P0001', message = 'DRAFT_MUST_BE_COMPLETED';
  end if;
  return new;
end;
$$;

create trigger events_active_draft_status_guard
before update of status on public.events
for each row
when (old.status is distinct from new.status)
execute function private.assert_draft_event_transition_allowed();

create trigger events_draft_mode_guard
before update of team_formation_mode on public.events
for each row
when (old.team_formation_mode is distinct from new.team_formation_mode)
execute function private.assert_no_active_player_draft();

create trigger event_managers_draft_guard
before insert or update or delete on public.event_managers
for each row execute function private.assert_no_active_player_draft();

create trigger teams_draft_guard
before insert or update or delete on public.teams
for each row execute function private.assert_no_active_player_draft();

create trigger team_members_draft_guard
before update or delete on public.team_members
for each row execute function private.assert_no_active_player_draft();

create trigger event_participants_draft_attendance_insert_delete_guard
before insert or delete on public.event_participants
for each row execute function private.assert_draft_attendance_unlocked();

create trigger event_participants_draft_attendance_update_guard
before update of actual_football, cancelled_at on public.event_participants
for each row execute function private.assert_draft_attendance_unlocked();

create function private.start_event_player_draft(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  actual_player_count integer;
  capacities integer[];
  required_team_count integer;
  configured_manager_count integer;
  remaining_player_count integer;
  first_team_id uuid;
  roster_over_capacity boolean;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DRAFT_AUTH_REQUIRED';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DRAFT_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'DRAFT_ADMIN_REQUIRED';
  end if;
  if target_event.status <> 'IN_PROGRESS'::public.event_status then
    raise exception using errcode = 'P0001', message = 'DRAFT_EVENT_NOT_IN_PROGRESS';
  end if;
  if target_event.team_formation_mode <> 'MANAGERS'::public.team_formation_mode then
    raise exception using errcode = 'P0001', message = 'DRAFT_MANAGERS_MODE_REQUIRED';
  end if;
  if exists (select 1 from public.event_drafts where event_id = target_event.id) then
    raise exception using errcode = 'P0001', message = 'DRAFT_ALREADY_STARTED';
  end if;

  select count(*)::integer
  into actual_player_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status;

  capacities := private.team_capacities_for_player_count(actual_player_count);
  required_team_count := cardinality(capacities);

  if (
    select count(*) <> required_team_count
      or min(team_row.position) <> 1
      or max(team_row.position) <> required_team_count
    from public.teams as team_row
    where team_row.event_id = target_event.id
  ) then
    raise exception using errcode = 'P0001', message = 'DRAFT_TEAM_PLAN_MISMATCH';
  end if;

  select count(*)::integer
  into configured_manager_count
  from public.event_managers as manager_row
  join public.group_members as member_row on member_row.id = manager_row.group_member_id
  where manager_row.event_id = target_event.id
    and member_row.group_id = target_event.group_id
    and member_row.deactivated_at is null
    and member_row.profile_id is not null;

  if configured_manager_count <> required_team_count then
    raise exception using errcode = 'P0001', message = 'DRAFT_MANAGERS_INCOMPLETE';
  end if;
  if exists (select 1 from public.team_members where event_id = target_event.id) then
    raise exception using errcode = 'P0001', message = 'DRAFT_ROSTER_NOT_EMPTY';
  end if;

  insert into public.event_drafts (event_id, team_capacities)
  values (target_event.id, capacities);

  insert into public.team_members (event_id, team_id, event_participant_id)
  select target_event.id, manager_row.team_id, participant.id
  from public.event_managers as manager_row
  join public.event_participants as participant
    on participant.event_id = manager_row.event_id
    and participant.group_member_id = manager_row.group_member_id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status
  where manager_row.event_id = target_event.id;

  select exists (
    select 1
    from public.teams as team_row
    where team_row.event_id = target_event.id
      and (
        select count(*)
        from public.team_members as roster
        where roster.event_id = team_row.event_id
          and roster.team_id = team_row.id
      ) > capacities[team_row.position]
  ) into roster_over_capacity;

  if roster_over_capacity then
    raise exception using errcode = 'P0001', message = 'DRAFT_MANAGER_CAPACITY_EXCEEDED';
  end if;

  select count(*)::integer
  into remaining_player_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status
    and not exists (
      select 1 from public.team_members as roster
      where roster.event_id = target_event.id
        and roster.event_participant_id = participant.id
    );

  first_team_id := private.next_draft_team(target_event.id, 0, capacities);
  if remaining_player_count = 0 then
    update public.event_drafts
    set status = 'COMPLETED', started_at = now(), completed_at = now(), version = 1
    where event_id = target_event.id;
  elsif first_team_id is null then
    raise exception using errcode = 'P0001', message = 'DRAFT_NO_AVAILABLE_TEAM';
  else
    update public.event_drafts
    set status = 'IN_PROGRESS', current_team_id = first_team_id, started_at = now(), version = 1
    where event_id = target_event.id;
  end if;
end;
$$;

create function public.start_event_player_draft(p_event_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$ select private.start_event_player_draft(p_event_id); $$;

create function private.select_draft_player(
  p_event_id uuid,
  p_event_participant_id uuid,
  p_expected_version bigint
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  draft_row public.event_drafts%rowtype;
  current_team public.teams%rowtype;
  selected_participant public.event_participants%rowtype;
  next_team_id uuid;
  remaining_player_count integer;
  current_roster_count integer;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DRAFT_AUTH_REQUIRED';
  end if;

  select draft.* into draft_row
  from public.event_drafts as draft
  where draft.event_id = p_event_id
  for update;

  if not found or draft_row.status <> 'IN_PROGRESS'::public.player_draft_status then
    raise exception using errcode = 'P0001', message = 'DRAFT_NOT_IN_PROGRESS';
  end if;
  if draft_row.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'DRAFT_STALE_STATE';
  end if;

  select team_row.* into current_team
  from public.teams as team_row
  where team_row.id = draft_row.current_team_id
    and team_row.event_id = draft_row.event_id;

  if not exists (
    select 1
    from public.event_managers as manager_row
    join public.group_members as member_row on member_row.id = manager_row.group_member_id
    where manager_row.event_id = draft_row.event_id
      and manager_row.team_id = current_team.id
      and member_row.profile_id = (select auth.uid())
      and member_row.deactivated_at is null
  ) then
    raise exception using errcode = '42501', message = 'DRAFT_NOT_CURRENT_MANAGER';
  end if;

  select participant.* into selected_participant
  from public.event_participants as participant
  where participant.id = p_event_participant_id
    and participant.event_id = draft_row.event_id
  for update;

  if not found
    or selected_participant.cancelled_at is not null
    or selected_participant.actual_football <> 'YES'::public.actual_attendance_status
  then
    raise exception using errcode = 'P0001', message = 'DRAFT_PLAYER_NOT_AVAILABLE';
  end if;
  if exists (
    select 1 from public.team_members as roster
    where roster.event_id = draft_row.event_id
      and roster.event_participant_id = selected_participant.id
  ) then
    raise exception using errcode = '23505', message = 'DRAFT_PLAYER_ALREADY_SELECTED';
  end if;

  select count(*)::integer into current_roster_count
  from public.team_members as roster
  where roster.event_id = draft_row.event_id
    and roster.team_id = current_team.id;
  if current_roster_count >= draft_row.team_capacities[current_team.position] then
    raise exception using errcode = 'P0001', message = 'DRAFT_TEAM_FULL';
  end if;

  insert into public.team_members (event_id, team_id, event_participant_id)
  values (draft_row.event_id, current_team.id, selected_participant.id);

  select count(*)::integer into remaining_player_count
  from public.event_participants as participant
  where participant.event_id = draft_row.event_id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status
    and not exists (
      select 1 from public.team_members as roster
      where roster.event_id = draft_row.event_id
        and roster.event_participant_id = participant.id
    );

  if remaining_player_count = 0 then
    update public.event_drafts
    set status = 'COMPLETED', current_team_id = null,
      pick_number = pick_number + 1, version = version + 1, completed_at = now()
    where event_id = draft_row.event_id;
    return;
  end if;

  next_team_id := private.next_draft_team(
    draft_row.event_id,
    current_team.position,
    draft_row.team_capacities
  );
  if next_team_id is null then
    raise exception using errcode = 'P0001', message = 'DRAFT_NO_AVAILABLE_TEAM';
  end if;

  update public.event_drafts
  set current_team_id = next_team_id,
    pick_number = pick_number + 1,
    version = version + 1
  where event_id = draft_row.event_id;
end;
$$;

create function public.select_draft_player(
  p_event_id uuid,
  p_event_participant_id uuid,
  p_expected_version bigint
)
returns void
language sql
volatile
set search_path = ''
as $$ select private.select_draft_player(p_event_id, p_event_participant_id, p_expected_version); $$;

create function private.get_event_player_draft(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  draft_row public.event_drafts%rowtype;
  capacities integer[];
  caller_team_id uuid;
  current_manager_name text;
  setup_ready boolean := false;
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DRAFT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row where event_row.id = p_event_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'DRAFT_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'DRAFT_ACCESS_DENIED';
  end if;

  select draft.* into draft_row
  from public.event_drafts as draft where draft.event_id = target_event.id;

  if found then
    capacities := draft_row.team_capacities;
  else
    begin
      capacities := private.team_capacities_for_player_count((
        select count(*)::integer from public.event_participants as participant
        where participant.event_id = target_event.id
          and participant.cancelled_at is null
          and participant.actual_football = 'YES'::public.actual_attendance_status
      ));
    exception when others then
      capacities := array[]::integer[];
    end;
  end if;

  setup_ready := cardinality(capacities) in (2, 3)
    and (
      select count(*) = cardinality(capacities)
        and min(team_row.position) = 1
        and max(team_row.position) = cardinality(capacities)
      from public.teams as team_row
      where team_row.event_id = target_event.id
    )
    and (
      select count(*) = cardinality(capacities)
      from public.event_managers as manager_row
      join public.group_members as member_row on member_row.id = manager_row.group_member_id
      where manager_row.event_id = target_event.id
        and member_row.group_id = target_event.group_id
        and member_row.deactivated_at is null
        and member_row.profile_id is not null
    )
    and not exists (
      select 1 from public.team_members as roster where roster.event_id = target_event.id
    );

  select manager_row.team_id into caller_team_id
  from public.event_managers as manager_row
  join public.group_members as member_row on member_row.id = manager_row.group_member_id
  where manager_row.event_id = target_event.id
    and member_row.profile_id = (select auth.uid())
    and member_row.deactivated_at is null;

  select member_row.display_name into current_manager_name
  from public.event_managers as manager_row
  join public.group_members as member_row on member_row.id = manager_row.group_member_id
  where manager_row.event_id = target_event.id
    and manager_row.team_id = draft_row.current_team_id;

  select jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'formationMode', target_event.team_formation_mode,
    'status', coalesce(draft_row.status, 'NOT_STARTED'::public.player_draft_status),
    'version', coalesce(draft_row.version, 0),
    'pickNumber', coalesce(draft_row.pick_number, 0),
    'currentTeamId', draft_row.current_team_id,
    'currentManagerName', current_manager_name,
    'currentUserTeamId', caller_team_id,
    'canCurrentUserPick', draft_row.status = 'IN_PROGRESS'
      and caller_team_id = draft_row.current_team_id,
    'canStart', draft_row.event_id is null
      and target_event.status = 'IN_PROGRESS'
      and target_event.team_formation_mode = 'MANAGERS'
      and setup_ready
      and private.is_group_admin(target_event.group_id),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamId', team_row.id,
        'teamName', team_row.name,
        'teamPosition', team_row.position,
        'capacity', coalesce(capacities[team_row.position], 0),
        'manager', jsonb_build_object(
          'groupMemberId', manager_row.group_member_id,
          'displayName', manager_member.display_name,
          'nickname', manager_member.nickname
        ),
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'participantId', participant.id,
            'displayName', coalesce(player_member.display_name, participant.guest_display_name),
            'avatarPath', player_member.avatar_url,
            'isGuest', participant.group_member_id is null
          ) order by roster.created_at)
          from public.team_members as roster
          join public.event_participants as participant
            on participant.id = roster.event_participant_id
            and participant.event_id = roster.event_id
          left join public.group_members as player_member
            on player_member.id = participant.group_member_id
          where roster.event_id = team_row.event_id and roster.team_id = team_row.id
        ), '[]'::jsonb)
      ) order by team_row.position)
      from public.teams as team_row
      join public.event_managers as manager_row
        on manager_row.event_id = team_row.event_id and manager_row.team_id = team_row.id
      join public.group_members as manager_member on manager_member.id = manager_row.group_member_id
      where team_row.event_id = target_event.id
    ), '[]'::jsonb),
    'availablePlayers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participantId', participant.id,
        'displayName', coalesce(member_row.display_name, participant.guest_display_name),
        'avatarPath', member_row.avatar_url,
        'isGuest', participant.group_member_id is null
      ) order by coalesce(member_row.display_name, participant.guest_display_name))
      from public.event_participants as participant
      left join public.group_members as member_row on member_row.id = participant.group_member_id
      where participant.event_id = target_event.id
        and participant.cancelled_at is null
        and participant.actual_football = 'YES'::public.actual_attendance_status
        and not exists (
          select 1 from public.team_members as roster
          where roster.event_id = target_event.id
            and roster.event_participant_id = participant.id
        )
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function public.get_event_player_draft(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_event_player_draft(p_event_id); $$;

alter table public.event_drafts enable row level security;
create policy "event_drafts_select_linked_members"
on public.event_drafts for select to authenticated
using (private.can_access_event(event_id));

revoke all on table public.event_drafts from anon, authenticated;
grant select on table public.event_drafts to authenticated;
grant all on table public.event_drafts to service_role;

revoke all on function private.team_capacities_for_player_count(integer) from public, anon, authenticated;
revoke all on function private.next_draft_team(uuid, integer, integer[]) from public, anon, authenticated;
revoke all on function private.assert_no_active_player_draft() from public, anon, authenticated;
revoke all on function private.assert_draft_attendance_unlocked() from public, anon, authenticated;
revoke all on function private.assert_draft_event_transition_allowed() from public, anon, authenticated;
revoke all on function private.start_event_player_draft(uuid) from public, anon, authenticated;
grant execute on function private.start_event_player_draft(uuid) to authenticated;
revoke all on function public.start_event_player_draft(uuid) from public, anon, authenticated;
grant execute on function public.start_event_player_draft(uuid) to authenticated;
revoke all on function private.select_draft_player(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function private.select_draft_player(uuid, uuid, bigint) to authenticated;
revoke all on function public.select_draft_player(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.select_draft_player(uuid, uuid, bigint) to authenticated;
revoke all on function private.get_event_player_draft(uuid) from public, anon, authenticated;
grant execute on function private.get_event_player_draft(uuid) to authenticated;
revoke all on function public.get_event_player_draft(uuid) from public, anon, authenticated;
grant execute on function public.get_event_player_draft(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_drafts'
  ) then
    alter publication supabase_realtime add table public.event_drafts;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'team_members'
  ) then
    alter publication supabase_realtime add table public.team_members;
  end if;
end;
$$;
