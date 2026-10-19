alter table public.match_settlement_items
  add constraint match_settlement_items_obligation_identity_unique
  unique (id, event_id, event_participant_id);

alter table public.dinner_settlement_items
  add constraint dinner_settlement_items_obligation_identity_unique
  unique (id, event_id, event_participant_id);

alter table public.payments
  add column match_settlement_item_id uuid,
  add column dinner_settlement_item_id uuid,
  add column recorded_by uuid references public.profiles (id) on delete restrict;

alter table public.payments
  add constraint payments_match_obligation_fk
    foreign key (match_settlement_item_id, event_id, event_participant_id)
    references public.match_settlement_items (id, event_id, event_participant_id)
    on delete restrict,
  add constraint payments_dinner_obligation_fk
    foreign key (dinner_settlement_item_id, event_id, event_participant_id)
    references public.dinner_settlement_items (id, event_id, event_participant_id)
    on delete restrict,
  add constraint payments_exactly_one_obligation check (
    (match_settlement_item_id is not null)::integer
    + (dinner_settlement_item_id is not null)::integer = 1
  ),
  add constraint payments_category_matches_obligation check (
    (category = 'COURT'::public.payment_category and match_settlement_item_id is not null)
    or
    (category = 'DINNER'::public.payment_category and dinner_settlement_item_id is not null)
  );

alter table public.payments
  drop constraint payments_paid_at_matches_status,
  add constraint payments_paid_marker_valid check (
    status = 'PAID'::public.payment_status
    and paid_at is not null
    and recorded_by is not null
  );

create unique index payments_match_obligation_unique
on public.payments (match_settlement_item_id)
where match_settlement_item_id is not null;

create unique index payments_dinner_obligation_unique
on public.payments (dinner_settlement_item_id)
where dinner_settlement_item_id is not null;

create index payments_recorded_by_idx
on public.payments (recorded_by);

create function private.get_event_payments(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'PAYMENTS_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'PAYMENTS_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'PAYMENTS_ACCESS_DENIED';
  end if;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'currencyCode', target_event.currency_code,
    'canManage', target_event.status = 'SETTLEMENT'::public.event_status
      and private.is_group_admin(target_event.group_id),
    'match', jsonb_build_object(
      'finalized', exists (
        select 1 from public.match_settlements as settlement
        where settlement.event_id = target_event.id
      ),
      'summary', (
        select jsonb_build_object(
          'totalCount', count(*),
          'paidCount', count(payment.id),
          'pendingCount', count(*) - count(payment.id),
          'totalAmountMinor', coalesce(sum(item.amount_minor), 0),
          'collectedAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
          'outstandingAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is null), 0)
        )
        from public.match_settlement_items as item
        left join public.payments as payment
          on payment.match_settlement_item_id = item.id
        where item.event_id = target_event.id
      ),
      'obligations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', item.id,
          'eventParticipantId', item.event_participant_id,
          'displayName', item.participant_display_name,
          'isGuest', item.is_guest,
          'isCurrentUser', membership.profile_id = (select auth.uid()),
          'avatarUrl', membership.avatar_url,
          'amountMinor', item.amount_minor,
          'status', case when payment.id is null then 'PENDING' else 'PAID' end,
          'paidAt', payment.paid_at,
          'updatedAt', payment.updated_at
        ) order by (payment.id is not null), item.allocation_order), '[]'::jsonb)
        from public.match_settlement_items as item
        join public.event_participants as participant on participant.id = item.event_participant_id
        left join public.group_members as membership on membership.id = participant.group_member_id
        left join public.payments as payment on payment.match_settlement_item_id = item.id
        where item.event_id = target_event.id
      )
    ),
    'dinner', jsonb_build_object(
      'finalized', exists (
        select 1 from public.dinner_settlements as settlement
        where settlement.event_id = target_event.id
      ),
      'summary', (
        select jsonb_build_object(
          'totalCount', count(*),
          'paidCount', count(payment.id),
          'pendingCount', count(*) - count(payment.id),
          'totalAmountMinor', coalesce(sum(item.amount_minor), 0),
          'collectedAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is not null), 0),
          'outstandingAmountMinor', coalesce(sum(item.amount_minor) filter (where payment.id is null), 0)
        )
        from public.dinner_settlement_items as item
        left join public.payments as payment
          on payment.dinner_settlement_item_id = item.id
        where item.event_id = target_event.id
      ),
      'obligations', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', item.id,
          'eventParticipantId', item.event_participant_id,
          'displayName', item.participant_display_name,
          'isGuest', item.is_guest,
          'isCurrentUser', membership.profile_id = (select auth.uid()),
          'avatarUrl', membership.avatar_url,
          'amountMinor', item.amount_minor,
          'status', case when payment.id is null then 'PENDING' else 'PAID' end,
          'paidAt', payment.paid_at,
          'updatedAt', payment.updated_at
        ) order by (payment.id is not null), item.allocation_order), '[]'::jsonb)
        from public.dinner_settlement_items as item
        join public.event_participants as participant on participant.id = item.event_participant_id
        left join public.group_members as membership on membership.id = participant.group_member_id
        left join public.payments as payment on payment.dinner_settlement_item_id = item.id
        where item.event_id = target_event.id
      )
    )
  );
end;
$$;

create function public.get_event_payments(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select private.get_event_payments(p_event_id); $$;

create function private.set_obligation_payment_status(
  p_category public.payment_category,
  p_obligation_id uuid,
  p_target_status public.payment_status,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_event public.events%rowtype;
  obligation_event_id uuid;
  obligation_participant_id uuid;
  obligation_amount_minor bigint;
  current_payment public.payments%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'PAYMENTS_AUTH_REQUIRED';
  end if;
  if p_category is null or p_obligation_id is null or p_target_status is null then
    raise exception using errcode = '22023', message = 'PAYMENTS_INPUT_INVALID';
  end if;

  if p_category = 'COURT'::public.payment_category then
    select item.event_id, item.event_participant_id, item.amount_minor
    into obligation_event_id, obligation_participant_id, obligation_amount_minor
    from public.match_settlement_items as item
    where item.id = p_obligation_id;
  else
    select item.event_id, item.event_participant_id, item.amount_minor
    into obligation_event_id, obligation_participant_id, obligation_amount_minor
    from public.dinner_settlement_items as item
    where item.id = p_obligation_id;
  end if;

  if obligation_event_id is null then
    raise exception using errcode = 'P0001', message = 'PAYMENTS_OBLIGATION_NOT_FOUND';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = obligation_event_id
  for update;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'PAYMENTS_ADMIN_REQUIRED';
  end if;
  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'PAYMENTS_EVENT_CLOSED';
  end if;
  if target_event.status <> 'SETTLEMENT'::public.event_status then
    raise exception using errcode = 'P0001', message = 'PAYMENTS_WRONG_LIFECYCLE';
  end if;

  if p_category = 'COURT'::public.payment_category then
    perform 1 from public.match_settlement_items where id = p_obligation_id for update;
    select payment.* into current_payment
    from public.payments as payment
    where payment.match_settlement_item_id = p_obligation_id
    for update;
  else
    perform 1 from public.dinner_settlement_items where id = p_obligation_id for update;
    select payment.* into current_payment
    from public.payments as payment
    where payment.dinner_settlement_item_id = p_obligation_id
    for update;
  end if;

  if p_target_status = 'PAID'::public.payment_status and current_payment.id is not null then
    return private.get_event_payments(obligation_event_id);
  end if;
  if p_target_status = 'PENDING'::public.payment_status and current_payment.id is null then
    return private.get_event_payments(obligation_event_id);
  end if;

  if current_payment.id is not null
    and (p_expected_updated_at is null or current_payment.updated_at <> p_expected_updated_at)
  then
    raise exception using errcode = '40001', message = 'PAYMENTS_CONFLICT';
  end if;

  if p_target_status = 'PAID'::public.payment_status then
    insert into public.payments (
      event_id,
      event_participant_id,
      category,
      amount_minor,
      status,
      paid_at,
      recorded_by,
      match_settlement_item_id,
      dinner_settlement_item_id
    ) values (
      obligation_event_id,
      obligation_participant_id,
      p_category,
      obligation_amount_minor,
      'PAID'::public.payment_status,
      clock_timestamp(),
      caller_profile_id,
      case when p_category = 'COURT'::public.payment_category then p_obligation_id end,
      case when p_category = 'DINNER'::public.payment_category then p_obligation_id end
    );
  else
    delete from public.payments where id = current_payment.id;
  end if;

  return private.get_event_payments(obligation_event_id);
end;
$$;

create function public.set_obligation_payment_status(
  p_category public.payment_category,
  p_obligation_id uuid,
  p_target_status public.payment_status,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.set_obligation_payment_status(
    p_category,
    p_obligation_id,
    p_target_status,
    p_expected_updated_at
  );
$$;

revoke all on function private.get_event_payments(uuid) from public, anon, authenticated;
revoke all on function private.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) from public, anon, authenticated;
revoke all on function public.get_event_payments(uuid) from public, anon;
revoke all on function public.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) from public, anon;

grant execute on function public.get_event_payments(uuid) to authenticated;
grant execute on function public.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) to authenticated;

grant all on table public.payments to service_role;
