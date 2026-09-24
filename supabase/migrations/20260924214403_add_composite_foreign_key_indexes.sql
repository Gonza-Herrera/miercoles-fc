create index event_managers_team_event_idx
  on public.event_managers (team_id, event_id);

create index group_invitations_member_group_idx
  on public.group_invitations (group_member_id, group_id);

create index payments_participant_event_idx
  on public.payments (event_participant_id, event_id);

create index team_members_participant_event_idx
  on public.team_members (event_participant_id, event_id);

create index team_members_team_event_idx
  on public.team_members (team_id, event_id);
