alter table public.events
add column match_attendance_recorded_at timestamptz,
add column match_attendance_recorded_by uuid references public.profiles (id) on delete restrict,
add constraint events_match_attendance_recording_complete check (
  (match_attendance_recorded_at is null) = (match_attendance_recorded_by is null)
);

update public.events as event_row
set
  match_attendance_recorded_at = attendance.last_recorded_at,
  match_attendance_recorded_by = event_row.created_by
from (
  select participant.event_id, max(participant.updated_at) as last_recorded_at
  from public.event_participants as participant
  where participant.actual_football <> 'UNSET'::public.actual_attendance_status
  group by participant.event_id
) as attendance
where event_row.id = attendance.event_id;

create index events_match_attendance_recorded_by_idx
on public.events (match_attendance_recorded_by)
where match_attendance_recorded_by is not null;

create table public.match_settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  court_amount_minor bigint not null,
  currency_code text not null,
  actual_player_count integer not null,
  total_allocated_minor bigint not null,
  finalized_by uuid not null references public.profiles (id) on delete restrict,
  finalized_at timestamptz not null default now(),
  constraint match_settlements_id_event_unique unique (id, event_id),
  constraint match_settlements_court_amount_valid check (
    court_amount_minor between 0 and 9007199254740991
  ),
  constraint match_settlements_currency_valid check (currency_code ~ '^[A-Z]{3}$'),
  constraint match_settlements_player_count_valid check (actual_player_count > 0),
  constraint match_settlements_allocation_exact check (
    total_allocated_minor = court_amount_minor
  )
);

create index match_settlements_finalized_by_idx
on public.match_settlements (finalized_by);

create table public.match_settlement_items (
  id uuid primary key default gen_random_uuid(),
  match_settlement_id uuid not null,
  event_id uuid not null,
  event_participant_id uuid not null,
  participant_display_name text not null,
  is_guest boolean not null,
  amount_minor bigint not null,
  allocation_order integer not null,
  created_at timestamptz not null default now(),
  constraint match_settlement_items_settlement_event_fk
    foreign key (match_settlement_id, event_id)
    references public.match_settlements (id, event_id)
    on delete restrict,
  constraint match_settlement_items_participant_event_fk
    foreign key (event_participant_id, event_id)
    references public.event_participants (id, event_id)
    on delete restrict,
  constraint match_settlement_items_participant_once
    unique (match_settlement_id, event_participant_id),
  constraint match_settlement_items_order_once
    unique (match_settlement_id, allocation_order),
  constraint match_settlement_items_name_valid check (
    char_length(btrim(participant_display_name)) between 1 and 100
  ),
  constraint match_settlement_items_amount_valid check (
    amount_minor between 0 and 9007199254740991
  ),
  constraint match_settlement_items_order_valid check (allocation_order >= 0)
);

create index match_settlement_items_event_participant_idx
on public.match_settlement_items (event_participant_id);

create index match_settlement_items_event_id_idx
on public.match_settlement_items (event_id);

alter table public.match_settlements enable row level security;
alter table public.match_settlement_items enable row level security;

create policy "match_settlements_select_group_members"
on public.match_settlements for select
to authenticated
using (private.can_access_event(event_id));

create policy "match_settlement_items_select_group_members"
on public.match_settlement_items for select
to authenticated
using (private.can_access_event(event_id));

revoke all on table public.match_settlements from anon, authenticated;
revoke all on table public.match_settlement_items from anon, authenticated;
grant select on table public.match_settlements to authenticated;
grant select on table public.match_settlement_items to authenticated;
grant all on table public.match_settlements to service_role;
grant all on table public.match_settlement_items to service_role;

create function private.get_match_settlement(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_settlement public.match_settlements%rowtype;
  actual_player_count integer;
  base_amount bigint;
  remainder integer;
  display_average bigint;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'MATCH_SETTLEMENT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'MATCH_SETTLEMENT_ACCESS_DENIED';
  end if;

  select settlement.* into target_settlement
  from public.match_settlements as settlement
  where settlement.event_id = target_event.id;

  select count(*) into actual_player_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status;

  if actual_player_count > 0 then
    base_amount := target_event.court_price_minor / actual_player_count;
    remainder := (target_event.court_price_minor % actual_player_count)::integer;
    display_average := base_amount + case
      when remainder * 2 >= actual_player_count then 1 else 0
    end;
  end if;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'courtAmountMinor', target_event.court_price_minor,
    'currencyCode', target_event.currency_code,
    'attendanceRecorded', target_event.match_attendance_recorded_at is not null,
    'actualPlayerCount', actual_player_count,
    'canFinalize', target_settlement.id is null
      and target_event.match_attendance_recorded_at is not null
      and actual_player_count > 0
      and target_event.court_price_minor >= 0
      and target_event.status = 'SETTLEMENT'::public.event_status
      and private.is_group_admin(target_event.group_id),
    'unavailableReason', case
      when target_settlement.id is not null then null
      when target_event.match_attendance_recorded_at is null then 'ATTENDANCE_NOT_RECORDED'
      when actual_player_count = 0 then 'NO_ACTUAL_PLAYERS'
      when target_event.court_price_minor is null or target_event.court_price_minor < 0
        then 'INVALID_COURT_PRICE'
      when target_event.status <> 'SETTLEMENT'::public.event_status then 'WRONG_LIFECYCLE'
      else null
    end,
    'preview', case
      when target_settlement.id is not null
        or target_event.match_attendance_recorded_at is null
        or actual_player_count = 0
        or target_event.court_price_minor is null
        or target_event.court_price_minor < 0
      then null
      else jsonb_build_object(
        'displayAverageMinor', display_average,
        'totalAllocatedMinor', target_event.court_price_minor,
        'allocations', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'eventParticipantId', player.id,
            'displayName', player.display_name,
            'isGuest', player.is_guest,
            'amountMinor', base_amount + case
              when player.allocation_order < remainder then 1 else 0
            end,
            'allocationOrder', player.allocation_order
          ) order by player.allocation_order), '[]'::jsonb)
          from (
            select
              participant.id,
              coalesce(member.display_name, participant.guest_display_name) as display_name,
              participant.group_member_id is null as is_guest,
              (row_number() over (
                order by participant.created_at, participant.id
              ))::integer - 1 as allocation_order
            from public.event_participants as participant
            left join public.group_members as member on member.id = participant.group_member_id
            where participant.event_id = target_event.id
              and participant.cancelled_at is null
              and participant.actual_football = 'YES'::public.actual_attendance_status
          ) as player
        )
      )
    end,
    'settlement', case when target_settlement.id is null then null else jsonb_build_object(
      'id', target_settlement.id,
      'eventId', target_settlement.event_id,
      'courtAmountMinor', target_settlement.court_amount_minor,
      'currencyCode', target_settlement.currency_code,
      'actualPlayerCount', target_settlement.actual_player_count,
      'totalAllocatedMinor', target_settlement.total_allocated_minor,
      'finalizedAt', target_settlement.finalized_at,
      'allocations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'eventParticipantId', item.event_participant_id,
          'displayName', item.participant_display_name,
          'isGuest', item.is_guest,
          'amountMinor', item.amount_minor,
          'allocationOrder', item.allocation_order
        ) order by item.allocation_order), '[]'::jsonb)
        from public.match_settlement_items as item
        where item.match_settlement_id = target_settlement.id
      )
    ) end
  );
end;
$$;

create function public.get_match_settlement(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_match_settlement(p_event_id); $$;

create function private.finalize_match_settlement(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  target_settlement public.match_settlements%rowtype;
  actual_player_count integer;
  base_amount bigint;
  remainder integer;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'MATCH_SETTLEMENT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'MATCH_SETTLEMENT_ADMIN_REQUIRED';
  end if;

  select settlement.* into target_settlement
  from public.match_settlements as settlement
  where settlement.event_id = target_event.id;

  if found then
    return private.get_match_settlement(target_event.id);
  end if;
  if target_event.status <> 'SETTLEMENT'::public.event_status then
    raise exception using errcode = 'P0001', message = case
      when target_event.status = 'CLOSED'::public.event_status
        then 'MATCH_SETTLEMENT_EVENT_CLOSED'
      else 'MATCH_SETTLEMENT_WRONG_LIFECYCLE'
    end;
  end if;
  if target_event.match_attendance_recorded_at is null then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_ATTENDANCE_NOT_RECORDED';
  end if;
  if target_event.court_price_minor is null or target_event.court_price_minor < 0 then
    raise exception using errcode = '22023', message = 'MATCH_SETTLEMENT_COURT_PRICE_INVALID';
  end if;

  select count(*) into actual_player_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status;

  if actual_player_count = 0 then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_NO_ACTUAL_PLAYERS';
  end if;

  base_amount := target_event.court_price_minor / actual_player_count;
  remainder := (target_event.court_price_minor % actual_player_count)::integer;

  insert into public.match_settlements (
    event_id,
    court_amount_minor,
    currency_code,
    actual_player_count,
    total_allocated_minor,
    finalized_by
  ) values (
    target_event.id,
    target_event.court_price_minor,
    target_event.currency_code,
    actual_player_count,
    target_event.court_price_minor,
    caller_profile_id
  ) returning * into target_settlement;

  insert into public.match_settlement_items (
    match_settlement_id,
    event_id,
    event_participant_id,
    participant_display_name,
    is_guest,
    amount_minor,
    allocation_order
  )
  select
    target_settlement.id,
    target_event.id,
    player.id,
    player.display_name,
    player.is_guest,
    base_amount + case when player.allocation_order < remainder then 1 else 0 end,
    player.allocation_order
  from (
    select
      participant.id,
      coalesce(member.display_name, participant.guest_display_name) as display_name,
      participant.group_member_id is null as is_guest,
      (row_number() over (order by participant.created_at, participant.id))::integer - 1
        as allocation_order
    from public.event_participants as participant
    left join public.group_members as member on member.id = participant.group_member_id
    where participant.event_id = target_event.id
      and participant.cancelled_at is null
      and participant.actual_football = 'YES'::public.actual_attendance_status
  ) as player
  order by player.allocation_order;

  if (select count(*) from public.match_settlement_items as item
      where item.match_settlement_id = target_settlement.id) <> actual_player_count
    or (select coalesce(sum(item.amount_minor), 0)
        from public.match_settlement_items as item
        where item.match_settlement_id = target_settlement.id) <> target_event.court_price_minor then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_ALLOCATION_INVALID';
  end if;

  return private.get_match_settlement(target_event.id);
end;
$$;

create function public.finalize_match_settlement(p_event_id uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$ select private.finalize_match_settlement(p_event_id); $$;

create function private.assert_match_settlement_event_source_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.court_price_minor is distinct from old.court_price_minor and exists (
    select 1 from public.match_settlements as settlement where settlement.event_id = new.id
  ) then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_SOURCE_LOCKED';
  end if;
  return new;
end;
$$;

create trigger events_match_settlement_source_guard
before update of court_price_minor on public.events
for each row execute function private.assert_match_settlement_event_source_unlocked();

create function private.assert_match_settlement_attendance_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  affects_actual_players boolean := false;
begin
  if tg_op = 'INSERT' then
    affects_actual_players := new.actual_football <> 'UNSET'::public.actual_attendance_status;
  elsif tg_op = 'DELETE' then
    affects_actual_players := old.actual_football = 'YES'::public.actual_attendance_status;
  else
    affects_actual_players := new.actual_football is distinct from old.actual_football
      or (
        old.actual_football = 'YES'::public.actual_attendance_status
        and new.cancelled_at is distinct from old.cancelled_at
      );
  end if;

  if affects_actual_players and exists (
    select 1 from public.match_settlements as settlement
    where settlement.event_id = target_event_id
  ) then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_SOURCE_LOCKED';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger event_participants_match_settlement_insert_delete_guard
before insert or delete on public.event_participants
for each row execute function private.assert_match_settlement_attendance_unlocked();

create trigger event_participants_match_settlement_update_guard
before update of actual_football, cancelled_at on public.event_participants
for each row execute function private.assert_match_settlement_attendance_unlocked();

create or replace function private.record_match_attendance(
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

  select event_row.* into target_event
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
  if exists (
    select 1 from public.match_settlements as settlement
    where settlement.event_id = target_event.id
  ) then
    raise exception using errcode = 'P0001', message = 'MATCH_SETTLEMENT_SOURCE_LOCKED';
  end if;

  for item in select value from jsonb_array_elements(p_attendances)
  loop
    item_group_member_id := nullif(item->>'group_member_id', '')::uuid;
    item_participant_id := nullif(item->>'participant_id', '')::uuid;
    item_attended := coalesce((item->>'attended')::boolean, false);

    if item_participant_id is not null then
      update public.event_participants
      set actual_football = case
        when item_attended then 'YES' else 'NO'
      end::public.actual_attendance_status
      where id = item_participant_id and event_id = target_event.id;
    elsif item_group_member_id is not null then
      insert into public.event_participants (event_id, group_member_id, actual_football)
      values (
        target_event.id,
        item_group_member_id,
        case when item_attended then 'YES' else 'NO' end::public.actual_attendance_status
      )
      on conflict (event_id, group_member_id)
      do update set actual_football = excluded.actual_football;
    end if;
  end loop;

  update public.events
  set
    match_attendance_recorded_at = pg_catalog.statement_timestamp(),
    match_attendance_recorded_by = caller_profile_id
  where id = target_event.id;
end;
$$;

revoke all on function private.get_match_settlement(uuid) from public, anon, authenticated;
revoke all on function public.get_match_settlement(uuid) from public, anon, authenticated;
revoke all on function private.finalize_match_settlement(uuid) from public, anon, authenticated;
revoke all on function public.finalize_match_settlement(uuid) from public, anon, authenticated;
revoke all on function private.assert_match_settlement_event_source_unlocked() from public;
revoke all on function private.assert_match_settlement_attendance_unlocked() from public;

grant execute on function private.get_match_settlement(uuid) to authenticated;
grant execute on function public.get_match_settlement(uuid) to authenticated;
grant execute on function private.finalize_match_settlement(uuid) to authenticated;
grant execute on function public.finalize_match_settlement(uuid) to authenticated;
