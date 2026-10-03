create or replace function private.get_event_team_lineup(p_event_id uuid)
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
            and participant.actual_football = 'YES'::public.actual_attendance_status
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
