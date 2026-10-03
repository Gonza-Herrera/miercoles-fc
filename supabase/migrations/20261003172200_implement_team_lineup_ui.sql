alter table public.team_members
  drop constraint team_members_one_team_per_event,
  add constraint team_members_one_team_per_event
    unique (event_id, event_participant_id)
    deferrable initially immediate;

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

create function private.get_event_team_lineup(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  draft_status public.player_draft_status;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'LINEUP_AUTH_REQUIRED';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'LINEUP_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'LINEUP_ACCESS_DENIED';
  end if;

  select draft_row.status
  into draft_status
  from public.event_drafts as draft_row
  where draft_row.event_id = target_event.id;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'formationMode', target_event.team_formation_mode,
    'canEdit', private.is_group_admin(target_event.group_id)
      and target_event.status in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status),
    'isComplete', target_event.team_formation_mode = 'RANDOM'::public.team_formation_mode
      or draft_status = 'COMPLETED'::public.player_draft_status,
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'teamId', team_row.id,
        'name', team_row.name,
        'order', team_row.position,
        'manager', case when manager_member.id is null then null else jsonb_build_object(
          'groupMemberId', manager_member.id,
          'displayName', manager_member.display_name,
          'nickname', manager_member.nickname,
          'avatarPath', manager_member.avatar_url
        ) end,
        'players', coalesce((
          select jsonb_agg(jsonb_build_object(
            'eventParticipantId', participant.id,
            'displayName', coalesce(player_member.display_name, participant.guest_display_name),
            'nickname', player_member.nickname,
            'avatarPath', player_member.avatar_url,
            'isGuest', participant.group_member_id is null
          ) order by roster.created_at, participant.id)
          from public.team_members as roster
          join public.event_participants as participant
            on participant.id = roster.event_participant_id
            and participant.event_id = roster.event_id
          left join public.group_members as player_member
            on player_member.id = participant.group_member_id
          where roster.event_id = team_row.event_id
            and roster.team_id = team_row.id
        ), '[]'::jsonb)
      ) order by team_row.position)
      from public.teams as team_row
      left join public.event_managers as manager_row
        on manager_row.event_id = team_row.event_id
        and manager_row.team_id = team_row.id
      left join public.group_members as manager_member
        on manager_member.id = manager_row.group_member_id
      where team_row.event_id = target_event.id
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_event_team_lineup(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_event_team_lineup(p_event_id); $$;

create function private.swap_event_team_players(
  p_event_id uuid,
  p_first_participant_id uuid,
  p_second_participant_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  first_roster public.team_members%rowtype;
  second_roster public.team_members%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'LINEUP_AUTH_REQUIRED';
  end if;
  if p_first_participant_id = p_second_participant_id then
    raise exception using errcode = '22023', message = 'LINEUP_PLAYERS_IDENTICAL';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'LINEUP_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'LINEUP_ADMIN_REQUIRED';
  end if;
  if target_event.status not in ('OPEN'::public.event_status, 'IN_PROGRESS'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'LINEUP_EVENT_READ_ONLY';
  end if;

  perform 1
  from public.team_members as roster
  where roster.event_id = target_event.id
    and roster.event_participant_id in (p_first_participant_id, p_second_participant_id)
  for update;

  select roster.* into first_roster
  from public.team_members as roster
  where roster.event_id = target_event.id
    and roster.event_participant_id = p_first_participant_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'LINEUP_FIRST_PLAYER_NOT_FOUND';
  end if;

  select roster.* into second_roster
  from public.team_members as roster
  where roster.event_id = target_event.id
    and roster.event_participant_id = p_second_participant_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'LINEUP_SECOND_PLAYER_NOT_FOUND';
  end if;
  if first_roster.team_id = second_roster.team_id then
    raise exception using errcode = '22023', message = 'LINEUP_SAME_TEAM';
  end if;

  perform set_config('app.lineup_swap', 'on', true);
  set constraints public.team_members_one_team_per_event deferred;

  update public.team_members
  set team_id = case id
    when first_roster.id then second_roster.team_id
    when second_roster.id then first_roster.team_id
  end
  where id in (first_roster.id, second_roster.id);

  if not found then
    raise exception using errcode = 'P0001', message = 'LINEUP_SWAP_FAILED';
  end if;
end;
$$;

create function public.swap_event_team_players(
  p_event_id uuid,
  p_first_participant_id uuid,
  p_second_participant_id uuid
)
returns void
language sql
volatile
set search_path = ''
as $$
  select private.swap_event_team_players(
    p_event_id,
    p_first_participant_id,
    p_second_participant_id
  );
$$;

revoke all on function private.get_event_team_lineup(uuid) from public, anon, authenticated;
grant execute on function private.get_event_team_lineup(uuid) to authenticated;
revoke all on function public.get_event_team_lineup(uuid) from public, anon, authenticated;
grant execute on function public.get_event_team_lineup(uuid) to authenticated;

revoke all on function private.swap_event_team_players(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function private.swap_event_team_players(uuid, uuid, uuid) to authenticated;
revoke all on function public.swap_event_team_players(uuid, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.swap_event_team_players(uuid, uuid, uuid) to authenticated;
