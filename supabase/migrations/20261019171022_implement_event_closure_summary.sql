alter table public.events
  add column closed_at timestamptz,
  add column closed_by uuid references public.profiles (id) on delete restrict;

update public.events
set closed_at = updated_at,
  closed_by = created_by
where status = 'CLOSED'::public.event_status;

alter table public.events
  add constraint events_closure_marker_complete check (
    (status = 'CLOSED'::public.event_status)
      = (closed_at is not null and closed_by is not null)
  );

create index events_closed_by_idx
on public.events (closed_by)
where closed_by is not null;

create or replace function private.enforce_event_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'CLOSED'::public.event_status and (
    new.status is distinct from old.status
    or new.starts_at is distinct from old.starts_at
    or new.location is distinct from old.location
    or new.court_price_minor is distinct from old.court_price_minor
    or new.currency_code is distinct from old.currency_code
    or new.title is distinct from old.title
    or new.closed_at is distinct from old.closed_at
    or new.closed_by is distinct from old.closed_by
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSED';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'DRAFT'::public.event_status and new.status = 'OPEN'::public.event_status)
    or (old.status = 'OPEN'::public.event_status and new.status = 'IN_PROGRESS'::public.event_status)
    or (old.status = 'IN_PROGRESS'::public.event_status and new.status = 'SETTLEMENT'::public.event_status)
    or (old.status = 'SETTLEMENT'::public.event_status and new.status = 'CLOSED'::public.event_status)
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_TRANSITION_INVALID';
  end if;

  if old.status in ('IN_PROGRESS'::public.event_status, 'SETTLEMENT'::public.event_status)
    and (
      new.starts_at is distinct from old.starts_at
      or new.location is distinct from old.location
      or new.currency_code is distinct from old.currency_code
      or new.title is distinct from old.title
    )
  then
    raise exception using errcode = 'P0001', message = 'EVENT_SCHEDULE_LOCKED';
  end if;

  return new;
end;
$$;

create or replace function private.transition_event_status(
  p_event_id uuid,
  p_target_status public.event_status
)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'EVENT_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'EVENT_ADMIN_REQUIRED';
  end if;
  if p_target_status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'EVENT_USE_CLOSE_RPC';
  end if;
  if p_target_status is null or not (
    (target_event.status = 'DRAFT'::public.event_status and p_target_status = 'OPEN'::public.event_status)
    or (target_event.status = 'OPEN'::public.event_status and p_target_status = 'IN_PROGRESS'::public.event_status)
    or (target_event.status = 'IN_PROGRESS'::public.event_status and p_target_status = 'SETTLEMENT'::public.event_status)
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_TRANSITION_INVALID';
  end if;

  update public.events as event_row
  set status = p_target_status
  where event_row.id = target_event.id
  returning event_row.* into target_event;
  return target_event;
end;
$$;

create function private.get_event_closure_summary(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  match_count bigint;
  dinner_count bigint;
  dinner_expense_total numeric;
  match_finalized boolean;
  dinner_finalized boolean;
  match_total numeric;
  match_collected numeric;
  match_paid_count bigint;
  dinner_total numeric;
  dinner_collected numeric;
  dinner_paid_count bigint;
  blocker text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'EVENT_CLOSURE_AUTH_REQUIRED';
  end if;
  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'EVENT_CLOSURE_ACCESS_DENIED';
  end if;

  select count(*) into match_count
  from public.event_participants as participant
  where participant.event_id = target_event.id and participant.cancelled_at is null
    and participant.actual_football = 'YES'::public.actual_attendance_status;
  select count(*) into dinner_count
  from public.event_participants as participant
  where participant.event_id = target_event.id and participant.cancelled_at is null
    and participant.actual_dinner = 'YES'::public.actual_attendance_status;
  select coalesce(sum(expense.amount_minor), 0) into dinner_expense_total
  from public.dinner_expenses as expense where expense.event_id = target_event.id;

  select exists(select 1 from public.match_settlements where event_id = target_event.id),
    coalesce(sum(item.amount_minor), 0),
    coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
    count(payment.id)
  into match_finalized, match_total, match_collected, match_paid_count
  from public.match_settlement_items as item
  left join public.payments as payment on payment.match_settlement_item_id = item.id
  where item.event_id = target_event.id;
  select exists(select 1 from public.dinner_settlements where event_id = target_event.id),
    coalesce(sum(item.amount_minor), 0),
    coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
    count(payment.id)
  into dinner_finalized, dinner_total, dinner_collected, dinner_paid_count
  from public.dinner_settlement_items as item
  left join public.payments as payment on payment.dinner_settlement_item_id = item.id
  where item.event_id = target_event.id;

  blocker := case
    when target_event.status not in ('SETTLEMENT'::public.event_status, 'CLOSED'::public.event_status)
      then 'WRONG_LIFECYCLE'
    when target_event.match_attendance_recorded_at is null
      or target_event.dinner_attendance_recorded_at is null then 'ATTENDANCE_NOT_RECORDED'
    when match_count = 0 and target_event.court_price_minor > 0 then 'MATCH_INVALID_NO_PLAYERS'
    when match_count > 0 and not match_finalized then 'MATCH_SETTLEMENT_REQUIRED'
    when dinner_count = 0 and dinner_expense_total > 0 then 'DINNER_INVALID_NO_DINERS'
    when dinner_count > 0 and dinner_expense_total > 0 and not dinner_finalized
      then 'DINNER_SETTLEMENT_REQUIRED'
    else null
  end;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', target_event.id, 'groupId', target_event.group_id, 'title', target_event.title,
      'startsAt', target_event.starts_at, 'location', target_event.location,
      'status', target_event.status, 'currencyCode', target_event.currency_code,
      'closedAt', target_event.closed_at, 'closedBy', target_event.closed_by
    ),
    'canClose', target_event.status = 'SETTLEMENT'::public.event_status
      and blocker is null and private.is_group_admin(target_event.group_id),
    'canManagePayments', target_event.status in (
      'SETTLEMENT'::public.event_status, 'CLOSED'::public.event_status
    ) and private.is_group_admin(target_event.group_id),
    'blocker', blocker,
    'match', jsonb_build_object(
      'attendanceRecorded', target_event.match_attendance_recorded_at is not null,
      'occurred', match_count > 0, 'actualCount', match_count,
      'courtAmountMinor', case when match_finalized then match_total else target_event.court_price_minor end,
      'settlementFinalized', match_finalized, 'paidCount', match_paid_count,
      'totalCount', case when match_finalized then match_count else 0 end,
      'collectedAmountMinor', match_collected,
      'outstandingAmountMinor', match_total - match_collected
    ),
    'dinner', jsonb_build_object(
      'attendanceRecorded', target_event.dinner_attendance_recorded_at is not null,
      'occurred', dinner_count > 0, 'actualCount', dinner_count,
      'expenseTotalMinor', dinner_expense_total,
      'settlementFinalized', dinner_finalized, 'paidCount', dinner_paid_count,
      'totalCount', case when dinner_finalized then dinner_count else 0 end,
      'collectedAmountMinor', dinner_collected,
      'outstandingAmountMinor', dinner_total - dinner_collected
    ),
    'financial', jsonb_build_object(
      'totalAmountMinor', match_total + dinner_total,
      'collectedAmountMinor', match_collected + dinner_collected,
      'outstandingAmountMinor', (match_total - match_collected) + (dinner_total - dinner_collected),
      'collectionComplete', (match_total - match_collected) + (dinner_total - dinner_collected) = 0
    )
  );
end;
$$;

create function public.get_event_closure_summary(p_event_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.get_event_closure_summary(p_event_id); $$;

create function private.close_event(p_event_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  match_count bigint;
  dinner_count bigint;
  dinner_expense_total numeric;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'EVENT_CLOSURE_AUTH_REQUIRED';
  end if;
  select event_row.* into target_event
  from public.events as event_row where event_row.id = p_event_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'EVENT_CLOSURE_ADMIN_REQUIRED';
  end if;
  if target_event.status = 'CLOSED'::public.event_status then
    return private.get_event_closure_summary(target_event.id);
  end if;
  if target_event.status <> 'SETTLEMENT'::public.event_status then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_WRONG_LIFECYCLE';
  end if;
  if target_event.match_attendance_recorded_at is null
    or target_event.dinner_attendance_recorded_at is null then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_ATTENDANCE_NOT_RECORDED';
  end if;
  select count(*) into match_count from public.event_participants
  where event_id = target_event.id and cancelled_at is null
    and actual_football = 'YES'::public.actual_attendance_status;
  select count(*) into dinner_count from public.event_participants
  where event_id = target_event.id and cancelled_at is null
    and actual_dinner = 'YES'::public.actual_attendance_status;
  select coalesce(sum(amount_minor), 0) into dinner_expense_total
  from public.dinner_expenses where event_id = target_event.id;
  if match_count = 0 and target_event.court_price_minor > 0 then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_MATCH_INVALID_NO_PLAYERS';
  end if;
  if match_count > 0 and not exists(
    select 1 from public.match_settlements where event_id = target_event.id
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_MATCH_SETTLEMENT_REQUIRED';
  end if;
  if dinner_count = 0 and dinner_expense_total > 0 then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_DINNER_INVALID_NO_DINERS';
  end if;
  if dinner_count > 0 and dinner_expense_total > 0 and not exists(
    select 1 from public.dinner_settlements where event_id = target_event.id
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSURE_DINNER_SETTLEMENT_REQUIRED';
  end if;
  update public.events set status = 'CLOSED'::public.event_status,
    closed_at = clock_timestamp(), closed_by = caller_profile_id
  where id = target_event.id;
  return private.get_event_closure_summary(target_event.id);
end;
$$;

create function public.close_event(p_event_id uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.close_event(p_event_id); $$;

create or replace function private.set_obligation_payment_status(
  p_category public.payment_category,
  p_obligation_id uuid,
  p_target_status public.payment_status,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  obligation_event_id uuid;
  obligation_participant_id uuid;
  obligation_amount_minor bigint;
  current_payment public.payments%rowtype;
begin
  if caller_profile_id is null then raise exception using errcode = '42501', message = 'PAYMENTS_AUTH_REQUIRED'; end if;
  if p_category is null or p_obligation_id is null or p_target_status is null then
    raise exception using errcode = '22023', message = 'PAYMENTS_INPUT_INVALID';
  end if;
  if p_category = 'COURT'::public.payment_category then
    select event_id, event_participant_id, amount_minor
    into obligation_event_id, obligation_participant_id, obligation_amount_minor
    from public.match_settlement_items where id = p_obligation_id;
  else
    select event_id, event_participant_id, amount_minor
    into obligation_event_id, obligation_participant_id, obligation_amount_minor
    from public.dinner_settlement_items where id = p_obligation_id;
  end if;
  if obligation_event_id is null then raise exception using errcode = 'P0001', message = 'PAYMENTS_OBLIGATION_NOT_FOUND'; end if;
  select * into target_event from public.events where id = obligation_event_id for update;
  if not private.is_group_admin(target_event.group_id) then raise exception using errcode = '42501', message = 'PAYMENTS_ADMIN_REQUIRED'; end if;
  if target_event.status not in ('SETTLEMENT'::public.event_status, 'CLOSED'::public.event_status) then
    raise exception using errcode = 'P0001', message = 'PAYMENTS_WRONG_LIFECYCLE';
  end if;
  if p_category = 'COURT'::public.payment_category then
    perform 1 from public.match_settlement_items where id = p_obligation_id for update;
    select * into current_payment from public.payments where match_settlement_item_id = p_obligation_id for update;
  else
    perform 1 from public.dinner_settlement_items where id = p_obligation_id for update;
    select * into current_payment from public.payments where dinner_settlement_item_id = p_obligation_id for update;
  end if;
  if p_target_status = 'PAID'::public.payment_status and current_payment.id is not null then return private.get_event_payments(obligation_event_id); end if;
  if p_target_status = 'PENDING'::public.payment_status and current_payment.id is null then return private.get_event_payments(obligation_event_id); end if;
  if current_payment.id is not null and (p_expected_updated_at is null or current_payment.updated_at <> p_expected_updated_at) then
    raise exception using errcode = '40001', message = 'PAYMENTS_CONFLICT';
  end if;
  if p_target_status = 'PAID'::public.payment_status then
    insert into public.payments (event_id, event_participant_id, category, amount_minor, status,
      paid_at, recorded_by, match_settlement_item_id, dinner_settlement_item_id)
    values (obligation_event_id, obligation_participant_id, p_category, obligation_amount_minor,
      'PAID'::public.payment_status, clock_timestamp(), caller_profile_id,
      case when p_category = 'COURT'::public.payment_category then p_obligation_id end,
      case when p_category = 'DINNER'::public.payment_category then p_obligation_id end);
  else
    delete from public.payments where id = current_payment.id;
  end if;
  return private.get_event_payments(obligation_event_id);
end;
$$;

create or replace function private.get_event_payments(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  target_event public.events%rowtype;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'PAYMENTS_AUTH_REQUIRED'; end if;
  select * into target_event from public.events where id = p_event_id;
  if not found then raise exception using errcode = 'P0001', message = 'PAYMENTS_EVENT_NOT_FOUND'; end if;
  if not private.can_access_event(target_event.id) then raise exception using errcode = '42501', message = 'PAYMENTS_ACCESS_DENIED'; end if;
  return jsonb_build_object(
    'eventId', target_event.id, 'eventStatus', target_event.status, 'currencyCode', target_event.currency_code,
    'canManage', target_event.status in ('SETTLEMENT'::public.event_status, 'CLOSED'::public.event_status)
      and private.is_group_admin(target_event.group_id),
    'match', jsonb_build_object('finalized', exists(select 1 from public.match_settlements where event_id = target_event.id),
      'summary', (select jsonb_build_object('totalCount', count(*), 'paidCount', count(payment.id),
        'pendingCount', count(*) - count(payment.id), 'totalAmountMinor', coalesce(sum(item.amount_minor), 0),
        'collectedAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
        'outstandingAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is null), 0))
        from public.match_settlement_items item left join public.payments payment on payment.match_settlement_item_id = item.id where item.event_id = target_event.id),
      'obligations', (select coalesce(jsonb_agg(jsonb_build_object('id', item.id, 'eventParticipantId', item.event_participant_id,
        'displayName', item.participant_display_name, 'isGuest', item.is_guest, 'isCurrentUser', membership.profile_id = (select auth.uid()),
        'avatarUrl', membership.avatar_url, 'amountMinor', item.amount_minor, 'status', case when payment.id is null then 'PENDING' else 'PAID' end,
        'paidAt', payment.paid_at, 'updatedAt', payment.updated_at) order by (payment.id is not null), item.allocation_order), '[]'::jsonb)
        from public.match_settlement_items item join public.event_participants participant on participant.id = item.event_participant_id
        left join public.group_members membership on membership.id = participant.group_member_id
        left join public.payments payment on payment.match_settlement_item_id = item.id where item.event_id = target_event.id)),
    'dinner', jsonb_build_object('finalized', exists(select 1 from public.dinner_settlements where event_id = target_event.id),
      'summary', (select jsonb_build_object('totalCount', count(*), 'paidCount', count(payment.id),
        'pendingCount', count(*) - count(payment.id), 'totalAmountMinor', coalesce(sum(item.amount_minor), 0),
        'collectedAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
        'outstandingAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is null), 0))
        from public.dinner_settlement_items item left join public.payments payment on payment.dinner_settlement_item_id = item.id where item.event_id = target_event.id),
      'obligations', (select coalesce(jsonb_agg(jsonb_build_object('id', item.id, 'eventParticipantId', item.event_participant_id,
        'displayName', item.participant_display_name, 'isGuest', item.is_guest, 'isCurrentUser', membership.profile_id = (select auth.uid()),
        'avatarUrl', membership.avatar_url, 'amountMinor', item.amount_minor, 'status', case when payment.id is null then 'PENDING' else 'PAID' end,
        'paidAt', payment.paid_at, 'updatedAt', payment.updated_at) order by (payment.id is not null), item.allocation_order), '[]'::jsonb)
        from public.dinner_settlement_items item join public.event_participants participant on participant.id = item.event_participant_id
        left join public.group_members membership on membership.id = participant.group_member_id
        left join public.payments payment on payment.dinner_settlement_item_id = item.id where item.event_id = target_event.id))
  );
end;
$$;

revoke all on function private.get_event_closure_summary(uuid) from public, anon, authenticated;
revoke all on function private.close_event(uuid) from public, anon, authenticated;
revoke all on function public.get_event_closure_summary(uuid) from public, anon;
revoke all on function public.close_event(uuid) from public, anon;
grant execute on function private.get_event_closure_summary(uuid) to authenticated;
grant execute on function private.close_event(uuid) to authenticated;
grant execute on function public.get_event_closure_summary(uuid) to authenticated;
grant execute on function public.close_event(uuid) to authenticated;
