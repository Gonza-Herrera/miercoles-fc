create table public.dinner_settlements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  expense_total_minor bigint not null,
  currency_code text not null,
  actual_diner_count integer not null,
  total_allocated_minor bigint not null,
  finalized_by uuid not null references public.profiles (id) on delete restrict,
  finalized_at timestamptz not null default now(),
  constraint dinner_settlements_id_event_unique unique (id, event_id),
  constraint dinner_settlements_expense_total_valid check (
    expense_total_minor between 1 and 9007199254740991
  ),
  constraint dinner_settlements_currency_valid check (currency_code ~ '^[A-Z]{3}$'),
  constraint dinner_settlements_diner_count_valid check (actual_diner_count > 0),
  constraint dinner_settlements_allocation_exact check (
    total_allocated_minor = expense_total_minor
  )
);

create index dinner_settlements_finalized_by_idx
on public.dinner_settlements (finalized_by);

create table public.dinner_settlement_items (
  id uuid primary key default gen_random_uuid(),
  dinner_settlement_id uuid not null,
  event_id uuid not null,
  event_participant_id uuid not null,
  participant_display_name text not null,
  is_guest boolean not null,
  amount_minor bigint not null,
  allocation_order integer not null,
  created_at timestamptz not null default now(),
  constraint dinner_settlement_items_settlement_event_fk
    foreign key (dinner_settlement_id, event_id)
    references public.dinner_settlements (id, event_id)
    on delete restrict,
  constraint dinner_settlement_items_participant_event_fk
    foreign key (event_participant_id, event_id)
    references public.event_participants (id, event_id)
    on delete restrict,
  constraint dinner_settlement_items_participant_once
    unique (dinner_settlement_id, event_participant_id),
  constraint dinner_settlement_items_order_once
    unique (dinner_settlement_id, allocation_order),
  constraint dinner_settlement_items_name_valid check (
    char_length(btrim(participant_display_name)) between 1 and 100
  ),
  constraint dinner_settlement_items_amount_valid check (
    amount_minor between 1 and 9007199254740991
  ),
  constraint dinner_settlement_items_order_valid check (allocation_order >= 0)
);

create index dinner_settlement_items_event_participant_idx
on public.dinner_settlement_items (event_participant_id);

create index dinner_settlement_items_event_id_idx
on public.dinner_settlement_items (event_id);

alter table public.dinner_settlements enable row level security;
alter table public.dinner_settlement_items enable row level security;

create policy "dinner_settlements_select_group_members"
on public.dinner_settlements for select
to authenticated
using ((select private.can_access_event(event_id)));

create policy "dinner_settlement_items_select_group_members"
on public.dinner_settlement_items for select
to authenticated
using ((select private.can_access_event(event_id)));

revoke all on table public.dinner_settlements from anon, authenticated;
revoke all on table public.dinner_settlement_items from anon, authenticated;
grant select on table public.dinner_settlements to authenticated;
grant select on table public.dinner_settlement_items to authenticated;
grant all on table public.dinner_settlements to service_role;
grant all on table public.dinner_settlement_items to service_role;

create function private.get_dinner_settlement(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_settlement public.dinner_settlements%rowtype;
  actual_diner_count integer;
  raw_expense_total numeric;
  expense_total bigint;
  expense_data_valid boolean;
  base_amount bigint;
  remainder integer;
  display_average bigint;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DINNER_SETTLEMENT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'DINNER_SETTLEMENT_ACCESS_DENIED';
  end if;

  select settlement.* into target_settlement
  from public.dinner_settlements as settlement
  where settlement.event_id = target_event.id;

  select count(*) into actual_diner_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_dinner = 'YES'::public.actual_attendance_status;

  select coalesce(sum(expense.amount_minor), 0::numeric) into raw_expense_total
  from public.dinner_expenses as expense
  where expense.event_id = target_event.id;

  expense_data_valid := raw_expense_total between 0 and 9007199254740991;
  expense_total := case when expense_data_valid then raw_expense_total::bigint else 0 end;

  if actual_diner_count > 0 and expense_total >= actual_diner_count then
    base_amount := expense_total / actual_diner_count;
    remainder := (expense_total % actual_diner_count)::integer;
    display_average := base_amount + case
      when remainder * 2 >= actual_diner_count then 1 else 0
    end;
  end if;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'expenseTotalMinor', expense_total,
    'currencyCode', target_event.currency_code,
    'attendanceRecorded', target_event.dinner_attendance_recorded_at is not null,
    'actualDinerCount', actual_diner_count,
    'canFinalize', target_settlement.id is null
      and target_event.dinner_attendance_recorded_at is not null
      and actual_diner_count > 0
      and expense_total >= actual_diner_count
      and expense_data_valid
      and target_event.status = 'SETTLEMENT'::public.event_status
      and private.is_group_admin(target_event.group_id),
    'unavailableReason', case
      when target_settlement.id is not null then null
      when target_event.dinner_attendance_recorded_at is null then 'ATTENDANCE_NOT_RECORDED'
      when actual_diner_count = 0 then 'NO_ACTUAL_DINERS'
      when expense_total = 0 and expense_data_valid then 'NO_DINNER_EXPENSES'
      when not expense_data_valid or expense_total < actual_diner_count
        then 'INVALID_EXPENSE_DATA'
      when target_event.status <> 'SETTLEMENT'::public.event_status then 'WRONG_LIFECYCLE'
      else null
    end,
    'preview', case
      when target_settlement.id is not null
        or target_event.dinner_attendance_recorded_at is null
        or actual_diner_count = 0
        or expense_total < actual_diner_count
        or not expense_data_valid
      then null
      else jsonb_build_object(
        'displayAverageMinor', display_average,
        'totalAllocatedMinor', expense_total,
        'allocations', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'eventParticipantId', diner.id,
            'displayName', diner.display_name,
            'isGuest', diner.is_guest,
            'amountMinor', base_amount + case
              when diner.allocation_order < remainder then 1 else 0
            end,
            'allocationOrder', diner.allocation_order
          ) order by diner.allocation_order), '[]'::jsonb)
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
              and participant.actual_dinner = 'YES'::public.actual_attendance_status
          ) as diner
        )
      )
    end,
    'settlement', case when target_settlement.id is null then null else jsonb_build_object(
      'id', target_settlement.id,
      'eventId', target_settlement.event_id,
      'expenseTotalMinor', target_settlement.expense_total_minor,
      'currencyCode', target_settlement.currency_code,
      'actualDinerCount', target_settlement.actual_diner_count,
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
        from public.dinner_settlement_items as item
        where item.dinner_settlement_id = target_settlement.id
      )
    ) end
  );
end;
$$;

create function public.get_dinner_settlement(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_dinner_settlement(p_event_id); $$;

create function private.finalize_dinner_settlement(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  target_settlement public.dinner_settlements%rowtype;
  actual_diner_count integer;
  raw_expense_total numeric;
  expense_total bigint;
  base_amount bigint;
  remainder integer;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'DINNER_SETTLEMENT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'DINNER_SETTLEMENT_ADMIN_REQUIRED';
  end if;

  select settlement.* into target_settlement
  from public.dinner_settlements as settlement
  where settlement.event_id = target_event.id;

  if found then
    return private.get_dinner_settlement(target_event.id);
  end if;
  if target_event.status <> 'SETTLEMENT'::public.event_status then
    raise exception using errcode = 'P0001', message = case
      when target_event.status = 'CLOSED'::public.event_status
        then 'DINNER_SETTLEMENT_EVENT_CLOSED'
      else 'DINNER_SETTLEMENT_WRONG_LIFECYCLE'
    end;
  end if;
  if target_event.dinner_attendance_recorded_at is null then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_ATTENDANCE_NOT_RECORDED';
  end if;

  select count(*) into actual_diner_count
  from public.event_participants as participant
  where participant.event_id = target_event.id
    and participant.cancelled_at is null
    and participant.actual_dinner = 'YES'::public.actual_attendance_status;

  if actual_diner_count = 0 then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_NO_ACTUAL_DINERS';
  end if;

  select coalesce(sum(expense.amount_minor), 0::numeric) into raw_expense_total
  from public.dinner_expenses as expense
  where expense.event_id = target_event.id;

  if raw_expense_total = 0 then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_NO_EXPENSES';
  end if;
  if raw_expense_total > 9007199254740991 or raw_expense_total < actual_diner_count then
    raise exception using errcode = '22023', message = 'DINNER_SETTLEMENT_EXPENSE_DATA_INVALID';
  end if;
  expense_total := raw_expense_total::bigint;
  base_amount := expense_total / actual_diner_count;
  remainder := (expense_total % actual_diner_count)::integer;

  insert into public.dinner_settlements (
    event_id,
    expense_total_minor,
    currency_code,
    actual_diner_count,
    total_allocated_minor,
    finalized_by
  ) values (
    target_event.id,
    expense_total,
    target_event.currency_code,
    actual_diner_count,
    expense_total,
    caller_profile_id
  ) returning * into target_settlement;

  insert into public.dinner_settlement_items (
    dinner_settlement_id,
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
    diner.id,
    diner.display_name,
    diner.is_guest,
    base_amount + case when diner.allocation_order < remainder then 1 else 0 end,
    diner.allocation_order
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
      and participant.actual_dinner = 'YES'::public.actual_attendance_status
  ) as diner
  order by diner.allocation_order;

  if (select count(*) from public.dinner_settlement_items as item
      where item.dinner_settlement_id = target_settlement.id) <> actual_diner_count
    or (select coalesce(sum(item.amount_minor), 0)
        from public.dinner_settlement_items as item
        where item.dinner_settlement_id = target_settlement.id) <> expense_total then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_ALLOCATION_INVALID';
  end if;

  return private.get_dinner_settlement(target_event.id);
end;
$$;

create function public.finalize_dinner_settlement(p_event_id uuid)
returns jsonb
language sql
volatile
set search_path = ''
as $$ select private.finalize_dinner_settlement(p_event_id); $$;

create function private.assert_dinner_settlement_expense_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
begin
  perform 1 from public.events as event_row
  where event_row.id = target_event_id
  for update;

  if exists (
    select 1 from public.dinner_settlements as settlement
    where settlement.event_id = target_event_id
  ) then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_SOURCE_LOCKED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger dinner_expenses_settlement_source_guard
before insert or update or delete on public.dinner_expenses
for each row execute function private.assert_dinner_settlement_expense_unlocked();

create function private.assert_dinner_settlement_attendance_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_event_id uuid := coalesce(new.event_id, old.event_id);
  affects_actual_diners boolean := false;
begin
  if tg_op = 'INSERT' then
    affects_actual_diners := new.actual_dinner <> 'UNSET'::public.actual_attendance_status;
  elsif tg_op = 'DELETE' then
    affects_actual_diners := old.actual_dinner = 'YES'::public.actual_attendance_status;
  else
    affects_actual_diners := new.actual_dinner is distinct from old.actual_dinner
      or (
        old.actual_dinner = 'YES'::public.actual_attendance_status
        and new.cancelled_at is distinct from old.cancelled_at
      );
  end if;

  if affects_actual_diners then
    perform 1 from public.events as event_row
    where event_row.id = target_event_id
    for update;
  end if;

  if affects_actual_diners and exists (
    select 1 from public.dinner_settlements as settlement
    where settlement.event_id = target_event_id
  ) then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_SOURCE_LOCKED';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger event_participants_dinner_settlement_insert_delete_guard
before insert or delete on public.event_participants
for each row execute function private.assert_dinner_settlement_attendance_unlocked();

create trigger event_participants_dinner_settlement_update_guard
before update of actual_dinner, cancelled_at on public.event_participants
for each row execute function private.assert_dinner_settlement_attendance_unlocked();

create function private.assert_dinner_settlement_recording_unlocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    new.dinner_attendance_recorded_at is distinct from old.dinner_attendance_recorded_at
    or new.dinner_attendance_recorded_by is distinct from old.dinner_attendance_recorded_by
  ) and exists (
    select 1 from public.dinner_settlements as settlement where settlement.event_id = new.id
  ) then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_SOURCE_LOCKED';
  end if;
  return new;
end;
$$;

create trigger events_dinner_settlement_recording_guard
before update of dinner_attendance_recorded_at, dinner_attendance_recorded_by on public.events
for each row execute function private.assert_dinner_settlement_recording_unlocked();

create or replace function private.assert_dinner_reality_write_allowed(
  target_event public.events
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if target_event.id is null then
    raise exception using errcode = 'P0001', message = 'DINNER_REALITY_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_ADMIN_REQUIRED';
  end if;
  if target_event.status not in (
    'IN_PROGRESS'::public.event_status,
    'SETTLEMENT'::public.event_status
  ) then
    raise exception using errcode = 'P0001', message = case
      when target_event.status = 'CLOSED'::public.event_status
        then 'DINNER_REALITY_EVENT_CLOSED'
      else 'DINNER_REALITY_NOT_STARTED'
    end;
  end if;
  if exists (
    select 1 from public.dinner_settlements as settlement
    where settlement.event_id = target_event.id
  ) then
    raise exception using errcode = 'P0001', message = 'DINNER_SETTLEMENT_SOURCE_LOCKED';
  end if;
end;
$$;

revoke all on function private.get_dinner_settlement(uuid) from public, anon, authenticated;
revoke all on function public.get_dinner_settlement(uuid) from public, anon, authenticated;
revoke all on function private.finalize_dinner_settlement(uuid)
from public, anon, authenticated;
revoke all on function public.finalize_dinner_settlement(uuid)
from public, anon, authenticated;
revoke all on function private.assert_dinner_settlement_expense_unlocked() from public;
revoke all on function private.assert_dinner_settlement_attendance_unlocked() from public;
revoke all on function private.assert_dinner_settlement_recording_unlocked() from public;

grant execute on function private.get_dinner_settlement(uuid) to authenticated;
grant execute on function public.get_dinner_settlement(uuid) to authenticated;
grant execute on function private.finalize_dinner_settlement(uuid) to authenticated;
grant execute on function public.finalize_dinner_settlement(uuid) to authenticated;
