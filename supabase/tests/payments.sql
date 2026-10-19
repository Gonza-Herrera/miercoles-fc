begin;

do $$
declare
  admin_profile_id uuid;
  test_group_id uuid := gen_random_uuid();
  admin_member_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  manager_team_id uuid := gen_random_uuid();
  unrelated_group_id uuid := gen_random_uuid();
  event_id uuid := gen_random_uuid();
  closed_event_id uuid := gen_random_uuid();
  draft_event_id uuid := gen_random_uuid();
  open_event_id uuid := gen_random_uuid();
  in_progress_event_id uuid := gen_random_uuid();
  summary_event_id uuid := gen_random_uuid();
  member_participant_id uuid := gen_random_uuid();
  guest_participant_id uuid := gen_random_uuid();
  closed_participant_id uuid := gen_random_uuid();
  draft_participant_id uuid := gen_random_uuid();
  open_participant_id uuid := gen_random_uuid();
  in_progress_participant_id uuid := gen_random_uuid();
  match_settlement_id uuid := gen_random_uuid();
  dinner_settlement_id uuid := gen_random_uuid();
  closed_settlement_id uuid := gen_random_uuid();
  draft_settlement_id uuid := gen_random_uuid();
  open_settlement_id uuid := gen_random_uuid();
  in_progress_settlement_id uuid := gen_random_uuid();
  summary_match_settlement_id uuid := gen_random_uuid();
  summary_dinner_settlement_id uuid := gen_random_uuid();
  match_item_id uuid := gen_random_uuid();
  dinner_item_id uuid := gen_random_uuid();
  guest_match_item_id uuid := gen_random_uuid();
  closed_item_id uuid := gen_random_uuid();
  guest_dinner_item_id uuid := gen_random_uuid();
  summary_expense_id uuid := gen_random_uuid();
  draft_item_id uuid := gen_random_uuid();
  open_item_id uuid := gen_random_uuid();
  in_progress_item_id uuid := gen_random_uuid();
  summary_participant_ids uuid[] := array[]::uuid[];
  first_paid_at timestamptz;
  first_updated_at timestamptz;
  view jsonb;
  caught boolean;
  lifecycle_item record;
begin
  select profile.id into admin_profile_id
  from public.profiles as profile
  order by profile.created_at, profile.id
  limit 1;
  if admin_profile_id is null then raise exception 'PAYMENTS_TEST_REQUIRES_PROFILE'; end if;

  perform set_config('request.jwt.claim.sub', admin_profile_id::text, true);
  insert into public.groups (id, name, created_by)
  values (test_group_id, 'PR23 transactional test', admin_profile_id);
  insert into public.group_members (id, group_id, profile_id, display_name, role)
  values (admin_member_id, test_group_id, admin_profile_id, 'Admin', 'ADMIN');
  insert into public.group_members (id, group_id, display_name, role)
  values (member_id, test_group_id, 'Member', 'MEMBER');

  insert into public.events (
    id, group_id, created_by, starts_at, location, court_price_minor, currency_code,
    status, team_formation_mode, closed_at, closed_by
  ) values
    (event_id, test_group_id, admin_profile_id, now(), 'Court', 10001, 'ARS', 'IN_PROGRESS', 'MANAGERS', null, null),
    (closed_event_id, test_group_id, admin_profile_id, now(), 'Court', 1000, 'ARS', 'CLOSED', 'RANDOM', now(), admin_profile_id),
    (draft_event_id, test_group_id, admin_profile_id, now(), 'Court', 1000, 'ARS', 'DRAFT', 'RANDOM', null, null),
    (open_event_id, test_group_id, admin_profile_id, now(), 'Court', 1000, 'ARS', 'OPEN', 'RANDOM', null, null),
    (in_progress_event_id, test_group_id, admin_profile_id, now(), 'Court', 1000, 'ARS', 'IN_PROGRESS', 'RANDOM', null, null),
    (summary_event_id, test_group_id, admin_profile_id, now(), 'Court', 5000000, 'ARS', 'SETTLEMENT', 'RANDOM', null, null);
  insert into public.event_participants (id, event_id, group_member_id)
  values (member_participant_id, event_id, member_id);
  insert into public.event_participants (
    id, event_id, guest_display_name, football_response, actual_football, created_by
  ) values (guest_participant_id, event_id, 'Guest', 'YES', 'YES', admin_profile_id);
  insert into public.event_participants (id, event_id, group_member_id)
  values
    (closed_participant_id, closed_event_id, admin_member_id),
    (draft_participant_id, draft_event_id, admin_member_id),
    (open_participant_id, open_event_id, admin_member_id),
    (in_progress_participant_id, in_progress_event_id, admin_member_id);
  insert into public.teams (id, event_id, name, position)
  values (manager_team_id, event_id, 'Managed team', 1);
  insert into public.event_managers (event_id, team_id, group_member_id)
  values (event_id, manager_team_id, admin_member_id);
  insert into public.dinner_plans (event_id, purchase_owner_group_member_id)
  values (event_id, admin_member_id);
  update public.events set status = 'SETTLEMENT' where id = event_id;

  for index_value in 1..11 loop
    summary_participant_ids := array_append(summary_participant_ids, gen_random_uuid());
    insert into public.event_participants (
      id, event_id, guest_display_name, football_response, dinner_response,
      actual_football, actual_dinner, created_by
    ) values (
      summary_participant_ids[index_value], summary_event_id,
      'Summary guest ' || index_value::text, 'YES', 'YES',
      case when index_value <= 9
        then 'YES'::public.actual_attendance_status
        else 'NO'::public.actual_attendance_status
      end,
      'YES', admin_profile_id
    );
  end loop;
  update public.events
  set match_attendance_recorded_at = now(), match_attendance_recorded_by = admin_profile_id,
    dinner_attendance_recorded_at = now(), dinner_attendance_recorded_by = admin_profile_id
  where id = summary_event_id;
  insert into public.dinner_expenses (id, event_id, description, amount_minor, created_by)
  values (summary_expense_id, summary_event_id, 'Summary dinner', 10000000, admin_profile_id);

  insert into public.match_settlements (
    id, event_id, court_amount_minor, currency_code, actual_player_count,
    total_allocated_minor, finalized_by
  ) values
    (match_settlement_id, event_id, 10001, 'ARS', 2, 10001, admin_profile_id),
    (closed_settlement_id, closed_event_id, 1000, 'ARS', 1, 1000, admin_profile_id),
    (draft_settlement_id, draft_event_id, 1000, 'ARS', 1, 1000, admin_profile_id),
    (open_settlement_id, open_event_id, 1000, 'ARS', 1, 1000, admin_profile_id),
    (in_progress_settlement_id, in_progress_event_id, 1000, 'ARS', 1, 1000, admin_profile_id);
  insert into public.dinner_settlements (
    id, event_id, expense_total_minor, currency_code, actual_diner_count,
    total_allocated_minor, finalized_by
  ) values
    (dinner_settlement_id, event_id, 12001, 'ARS', 2, 12001, admin_profile_id),
    (summary_dinner_settlement_id, summary_event_id, 10000000, 'ARS', 11,
      10000000, admin_profile_id);
  insert into public.match_settlements (
    id, event_id, court_amount_minor, currency_code, actual_player_count,
    total_allocated_minor, finalized_by
  ) values (
    summary_match_settlement_id, summary_event_id, 5000000, 'ARS', 9,
    5000000, admin_profile_id
  );

  insert into public.match_settlement_items (
    id, match_settlement_id, event_id, event_participant_id,
    participant_display_name, is_guest, amount_minor, allocation_order
  ) values
    (match_item_id, match_settlement_id, event_id, member_participant_id,
      'Member', false, 5001, 0),
    (guest_match_item_id, match_settlement_id, event_id, guest_participant_id,
      'Guest', true, 5000, 1),
    (closed_item_id, closed_settlement_id, closed_event_id, closed_participant_id,
      'Admin', false, 1000, 0),
    (draft_item_id, draft_settlement_id, draft_event_id, draft_participant_id,
      'Admin', false, 1000, 0),
    (open_item_id, open_settlement_id, open_event_id, open_participant_id,
      'Admin', false, 1000, 0),
    (in_progress_item_id, in_progress_settlement_id, in_progress_event_id,
      in_progress_participant_id, 'Admin', false, 1000, 0);
  insert into public.dinner_settlement_items (
    id, dinner_settlement_id, event_id, event_participant_id,
    participant_display_name, is_guest, amount_minor, allocation_order
  ) values
    (dinner_item_id, dinner_settlement_id, event_id, member_participant_id,
      'Member', false, 7001, 0),
    (guest_dinner_item_id, dinner_settlement_id, event_id, guest_participant_id,
      'Guest', true, 5000, 1);

  for index_value in 1..11 loop
    insert into public.dinner_settlement_items (
      dinner_settlement_id, event_id, event_participant_id,
      participant_display_name, is_guest, amount_minor, allocation_order
    ) values (
      summary_dinner_settlement_id, summary_event_id,
      summary_participant_ids[index_value], 'Summary guest ' || index_value::text,
      true, case when index_value <= 10 then 909091 else 909090 end, index_value - 1
    );
    if index_value <= 9 then
      insert into public.match_settlement_items (
        match_settlement_id, event_id, event_participant_id,
        participant_display_name, is_guest, amount_minor, allocation_order
      ) values (
        summary_match_settlement_id, summary_event_id,
        summary_participant_ids[index_value], 'Summary guest ' || index_value::text,
        true, case when index_value <= 5 then 555556 else 555555 end, index_value - 1
      );
    end if;
  end loop;

  view := private.get_event_payments(event_id);
  if view #>> '{match,summary,pendingCount}' <> '2'
    or view #>> '{dinner,summary,pendingCount}' <> '2'
    or view #>> '{match,summary,outstandingAmountMinor}' <> '10001'
    or view #>> '{dinner,summary,outstandingAmountMinor}' <> '12001'
  then raise exception 'PAYMENTS_INITIAL_PENDING_INVALID'; end if;

  for lifecycle_item in
    select item.id
    from public.match_settlement_items as item
    where item.match_settlement_id = summary_match_settlement_id
      and item.allocation_order not in (4, 8)
    order by item.allocation_order
  loop
    perform private.set_obligation_payment_status(
      'COURT', lifecycle_item.id, 'PAID', null
    );
  end loop;
  for lifecycle_item in
    select item.id
    from public.dinner_settlement_items as item
    where item.dinner_settlement_id = summary_dinner_settlement_id
      and item.allocation_order < 8
    order by item.allocation_order
  loop
    perform private.set_obligation_payment_status(
      'DINNER', lifecycle_item.id, 'PAID', null
    );
  end loop;
  view := private.get_event_payments(summary_event_id);
  if view #>> '{match,summary,paidCount}' <> '7'
    or view #>> '{match,summary,pendingCount}' <> '2'
    or view #>> '{match,summary,outstandingAmountMinor}' <> '1111111'
    or view #>> '{match,summary,totalAmountMinor}' <> '5000000'
    or (
      (view #>> '{match,summary,collectedAmountMinor}')::bigint
      + (view #>> '{match,summary,outstandingAmountMinor}')::bigint
    ) <> 5000000
    or view #>> '{dinner,summary,paidCount}' <> '8'
    or view #>> '{dinner,summary,pendingCount}' <> '3'
    or view #>> '{dinner,summary,outstandingAmountMinor}' <> '2727272'
    or view #>> '{dinner,summary,totalAmountMinor}' <> '10000000'
    or (
      (view #>> '{dinner,summary,collectedAmountMinor}')::bigint
      + (view #>> '{dinner,summary,outstandingAmountMinor}')::bigint
    ) <> 10000000
  then raise exception 'PAYMENTS_EXACT_SUMMARY_INVALID'; end if;

  view := private.close_event(summary_event_id);
  if view #>> '{event,status}' <> 'CLOSED'
    or view #>> '{match,actualCount}' <> '9'
    or view #>> '{dinner,actualCount}' <> '11'
    or view #>> '{match,outstandingAmountMinor}' <> '1111111'
    or view #>> '{dinner,outstandingAmountMinor}' <> '2727272'
    or view #>> '{financial,outstandingAmountMinor}' <> '3838383'
    or (view #>> '{financial,collectionComplete}')::boolean
  then raise exception 'EVENT_CLOSURE_SUMMARY_INVALID'; end if;
  if (select closed_at is null or closed_by <> admin_profile_id from public.events where id = summary_event_id)
  then raise exception 'EVENT_CLOSURE_AUDIT_INVALID'; end if;
  view := private.close_event(summary_event_id);
  if view #>> '{event,status}' <> 'CLOSED' then raise exception 'EVENT_CLOSURE_NOT_IDEMPOTENT'; end if;
  caught := false;
  begin
    perform private.update_dinner_expense(
      summary_event_id, summary_expense_id, 'Changed', 10000001,
      (select updated_at from public.dinner_expenses where id = summary_expense_id)
    );
  exception when others then
    caught := sqlerrm = 'DINNER_REALITY_EVENT_CLOSED';
  end;
  if not caught then raise exception 'EVENT_CLOSED_EXPENSE_MUTATED'; end if;

  select item.* into lifecycle_item
  from public.match_settlement_items as item
  where item.match_settlement_id = summary_match_settlement_id
    and item.allocation_order = 4;
  view := private.set_obligation_payment_status('COURT', lifecycle_item.id, 'PAID', null);
  if view #>> '{eventStatus}' <> 'CLOSED'
    or view #>> '{match,summary,outstandingAmountMinor}' <> '555555'
  then raise exception 'EVENT_CLOSED_PAYMENT_UPDATE_INVALID'; end if;

  perform private.set_obligation_payment_status('COURT', match_item_id, 'PAID', null);
  select paid_at, updated_at into first_paid_at, first_updated_at from public.payments
  where match_settlement_item_id = match_item_id;
  if first_paid_at is null
    or (select recorded_by from public.payments where match_settlement_item_id = match_item_id)
      <> admin_profile_id
    or (select amount_minor from public.payments where match_settlement_item_id = match_item_id)
      <> 5001
  then raise exception 'PAYMENTS_SERVER_METADATA_INVALID'; end if;
  perform private.set_obligation_payment_status('COURT', match_item_id, 'PAID', null);
  if (select count(*) from public.payments where match_settlement_item_id = match_item_id) <> 1
    or (select paid_at from public.payments where match_settlement_item_id = match_item_id) <> first_paid_at
  then raise exception 'PAYMENTS_PAID_NOT_IDEMPOTENT'; end if;

  perform private.set_obligation_payment_status('DINNER', dinner_item_id, 'PAID', null);
  view := private.get_event_payments(event_id);
  if view #>> '{match,summary,paidCount}' <> '1'
    or view #>> '{match,summary,outstandingAmountMinor}' <> '5000'
    or view #>> '{dinner,summary,paidCount}' <> '1'
    or view #>> '{dinner,summary,outstandingAmountMinor}' <> '5000'
  then raise exception 'PAYMENTS_DOMAINS_NOT_INDEPENDENT'; end if;

  perform private.set_obligation_payment_status('COURT', guest_match_item_id, 'PAID', null);
  perform private.set_obligation_payment_status('DINNER', guest_dinner_item_id, 'PAID', null);
  if not exists (
    select 1 from public.payments where match_settlement_item_id = guest_match_item_id
  ) or not exists (
    select 1 from public.payments where dinner_settlement_item_id = guest_dinner_item_id
  ) then raise exception 'PAYMENTS_GUEST_NOT_SUPPORTED'; end if;

  caught := false;
  begin
    perform private.set_obligation_payment_status(
      'COURT', match_item_id, 'PENDING', first_updated_at - interval '1 second'
    );
  exception when others then caught := sqlerrm = 'PAYMENTS_CONFLICT'; end;
  if not caught then raise exception 'PAYMENTS_STALE_WRITE_NOT_REJECTED'; end if;

  perform private.set_obligation_payment_status('COURT', match_item_id, 'PENDING', first_updated_at);
  perform private.set_obligation_payment_status('COURT', match_item_id, 'PENDING', null);
  if exists (
    select 1 from public.payments where match_settlement_item_id = match_item_id
  ) then raise exception 'PAYMENTS_PENDING_REVERT_NOT_IDEMPOTENT'; end if;

  update public.group_members set role = 'MEMBER' where id = admin_member_id;
  caught := false;
  begin perform private.set_obligation_payment_status('DINNER', dinner_item_id, 'PENDING', null);
  exception when others then caught := sqlerrm = 'PAYMENTS_ADMIN_REQUIRED'; end;
  if not caught then raise exception 'PAYMENTS_MEMBER_MUTATED'; end if;
  update public.group_members set role = 'ADMIN' where id = admin_member_id;

  perform private.set_obligation_payment_status('COURT', closed_item_id, 'PAID', null);
  if not exists (select 1 from public.payments where match_settlement_item_id = closed_item_id)
    or (select status from public.events where id = closed_event_id) <> 'CLOSED'::public.event_status
  then raise exception 'PAYMENTS_CLOSED_UPDATE_INVALID'; end if;

  for lifecycle_item in
    select * from (values
      (draft_item_id, 'DRAFT'),
      (open_item_id, 'OPEN'),
      (in_progress_item_id, 'IN_PROGRESS')
    ) as lifecycle(item_id, event_status)
  loop
    caught := false;
    begin
      perform private.set_obligation_payment_status(
        'COURT', lifecycle_item.item_id, 'PAID', null
      );
    exception when others then caught := sqlerrm = 'PAYMENTS_WRONG_LIFECYCLE'; end;
    if not caught then
      raise exception 'PAYMENTS_WRONG_LIFECYCLE_MUTATED_%', lifecycle_item.event_status;
    end if;
  end loop;

  caught := false;
  begin
    insert into public.payments (
      event_id, event_participant_id, category, amount_minor, status,
      paid_at, recorded_by, match_settlement_item_id
    ) values (
      event_id, member_participant_id, 'COURT', 9999, 'PAID',
      clock_timestamp(), admin_profile_id, match_item_id
    );
  exception when others then caught := sqlerrm = 'PAYMENTS_AMOUNT_MUST_MATCH_OBLIGATION'; end;
  if not caught then raise exception 'PAYMENTS_AMOUNT_MISMATCH_ACCEPTED'; end if;

  caught := false;
  begin
    perform private.set_obligation_payment_status(
      'COURT', match_item_id, 'PARTIAL'::text::public.payment_status, null
    );
  exception when invalid_text_representation then caught := true; end;
  if not caught then raise exception 'PAYMENTS_INVALID_STATUS_ACCEPTED'; end if;

  update public.group_members set role = 'MEMBER' where id = admin_member_id;
  insert into public.groups (id, name, created_by)
  values (unrelated_group_id, 'Unrelated admin group', admin_profile_id);
  insert into public.group_members (group_id, profile_id, display_name, role)
  values (unrelated_group_id, admin_profile_id, 'Unrelated admin', 'ADMIN');
  caught := false;
  begin perform private.set_obligation_payment_status('DINNER', dinner_item_id, 'PENDING', null);
  exception when others then caught := sqlerrm = 'PAYMENTS_ADMIN_REQUIRED'; end;
  if not caught then raise exception 'PAYMENTS_DT_OWNER_OR_UNRELATED_ADMIN_MUTATED'; end if;
  update public.group_members set role = 'ADMIN' where id = admin_member_id;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  caught := false;
  begin perform private.get_event_payments(event_id);
  exception when others then caught := sqlerrm = 'PAYMENTS_ACCESS_DENIED'; end;
  if not caught then raise exception 'PAYMENTS_UNRELATED_USER_READ'; end if;
  caught := false;
  begin perform private.set_obligation_payment_status('COURT', match_item_id, 'PAID', null);
  exception when others then caught := sqlerrm = 'PAYMENTS_ADMIN_REQUIRED'; end;
  if not caught then raise exception 'PAYMENTS_UNRELATED_USER_MUTATED'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  caught := false;
  begin perform private.get_event_payments(event_id);
  exception when others then caught := sqlerrm = 'PAYMENTS_AUTH_REQUIRED'; end;
  if not caught then raise exception 'PAYMENTS_ANON_READ'; end if;
  caught := false;
  begin perform private.set_obligation_payment_status('COURT', match_item_id, 'PAID', null);
  exception when others then caught := sqlerrm = 'PAYMENTS_AUTH_REQUIRED'; end;
  if not caught then raise exception 'PAYMENTS_ANON_MUTATED'; end if;

  if has_table_privilege('anon', 'public.payments', 'SELECT')
    or has_table_privilege('authenticated', 'public.payments', 'INSERT')
    or has_table_privilege('authenticated', 'public.payments', 'UPDATE')
    or has_table_privilege('authenticated', 'public.payments', 'DELETE')
    or not has_table_privilege('authenticated', 'public.payments', 'SELECT')
  then raise exception 'PAYMENTS_TABLE_GRANTS_INVALID'; end if;
  if has_function_privilege('anon', 'public.get_event_payments(uuid)', 'EXECUTE')
    or has_function_privilege(
      'anon',
      'public.set_obligation_payment_status(public.payment_category,uuid,public.payment_status,timestamptz)',
      'EXECUTE'
    )
    or not has_function_privilege('authenticated', 'public.get_event_payments(uuid)', 'EXECUTE')
  then raise exception 'PAYMENTS_FUNCTION_GRANTS_INVALID'; end if;

  if (select amount_minor from public.match_settlement_items where id = match_item_id) <> 5001
    or (select amount_minor from public.dinner_settlement_items where id = dinner_item_id) <> 7001
  then raise exception 'PAYMENTS_CHANGED_SETTLEMENT_AMOUNTS'; end if;
end;
$$;

rollback;
