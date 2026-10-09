begin;

do $$
declare
  admin_profile_id uuid;
  test_group_id uuid := gen_random_uuid();
  admin_member_id uuid := gen_random_uuid();
  backup_admin_id uuid := gen_random_uuid();
  manager_team_id uuid := gen_random_uuid();
  test_event_id uuid := gen_random_uuid();
  unrecorded_event_id uuid := gen_random_uuid();
  zero_diners_event_id uuid := gen_random_uuid();
  zero_expenses_event_id uuid := gen_random_uuid();
  match_final_event_id uuid := gen_random_uuid();
  match_final_participant_id uuid := gen_random_uuid();
  match_settlement_id uuid := gen_random_uuid();
  target_dinner_settlement_id uuid;
  first_diner_id uuid;
  lucas_participant_id uuid;
  guest_participant_id uuid;
  first_expense_id uuid;
  item_count integer;
  high_count integer;
  low_count integer;
  allocated_total bigint;
  payment_count integer;
  match_count integer;
  football_yes_count integer;
  court_price bigint;
  caught boolean;
begin
  select profile.id into admin_profile_id
  from public.profiles as profile
  order by profile.created_at, profile.id
  limit 1;

  if admin_profile_id is null then
    raise exception 'DINNER_SETTLEMENT_TEST_REQUIRES_PROFILE';
  end if;
  perform set_config('request.jwt.claim.sub', admin_profile_id::text, true);

  insert into public.groups (id, name, created_by)
  values (test_group_id, 'PR22 transactional test', admin_profile_id);
  insert into public.group_members (id, group_id, profile_id, display_name, role)
  values (admin_member_id, test_group_id, admin_profile_id, 'Admin test', 'ADMIN');
  insert into public.group_members (id, group_id, display_name, role)
  values (backup_admin_id, test_group_id, 'Backup admin', 'ADMIN');

  insert into public.events (
    id, group_id, created_by, starts_at, location, court_price_minor,
    currency_code, status, dinner_attendance_recorded_at, dinner_attendance_recorded_by
  ) values
    (test_event_id, test_group_id, admin_profile_id, now(), 'Test court', 777700,
      'ARS', 'IN_PROGRESS', now(), admin_profile_id),
    (unrecorded_event_id, test_group_id, admin_profile_id, now(), 'Test court', 1,
      'ARS', 'SETTLEMENT', null, null),
    (zero_diners_event_id, test_group_id, admin_profile_id, now(), 'Test court', 1,
      'ARS', 'SETTLEMENT', now(), admin_profile_id),
    (zero_expenses_event_id, test_group_id, admin_profile_id, now(), 'Test court', 1,
      'ARS', 'SETTLEMENT', now(), admin_profile_id),
    (match_final_event_id, test_group_id, admin_profile_id, now(), 'Test court', 123400,
      'ARS', 'SETTLEMENT', now(), admin_profile_id);

  update public.events set team_formation_mode = 'MANAGERS' where id = test_event_id;
  insert into public.teams (id, event_id, name, position)
  values (manager_team_id, test_event_id, 'Team test', 1);
  insert into public.event_managers (event_id, team_id, group_member_id)
  values (test_event_id, manager_team_id, admin_member_id);
  insert into public.dinner_plans (event_id, menu, purchase_owner_group_member_id)
  values (test_event_id, 'Planned menu ignored', admin_member_id);
  insert into public.dinner_planned_purchases (dinner_plan_id, name, sort_order)
  select plan.id, 'Planned purchase ignored', 0
  from public.dinner_plans as plan where plan.event_id = test_event_id;
  update public.events set status = 'SETTLEMENT' where id = test_event_id;

  for index_value in 1..11 loop
    declare
      member_id uuid := gen_random_uuid();
      participant_id uuid := gen_random_uuid();
      diner_name text := case index_value
        when 1 then 'Gonzalo'
        when 2 then 'Lucas'
        when 3 then 'Carla'
        when 4 then 'Matías'
        else 'Diner ' || index_value::text
      end;
      dinner_response public.attendance_response := case index_value
        when 1 then 'YES'
        when 2 then 'YES'
        when 3 then 'NO'
        when 4 then 'UNKNOWN'
        else 'YES'
      end;
      dinner_actual public.actual_attendance_status := case
        when index_value = 2 then 'NO' else 'YES'
      end;
      football_actual public.actual_attendance_status := case
        when index_value in (1, 2) then 'YES' else 'NO'
      end;
    begin
      insert into public.group_members (id, group_id, display_name)
      values (member_id, test_group_id, diner_name);
      insert into public.event_participants (
        id, event_id, group_member_id, dinner_response, actual_dinner, actual_football,
        created_at, updated_at
      ) values (
        participant_id, test_event_id, member_id, dinner_response, dinner_actual,
        football_actual, now() + index_value * interval '1 second',
        now() + index_value * interval '1 second'
      );
      if index_value = 1 then first_diner_id := participant_id; end if;
      if index_value = 2 then lucas_participant_id := participant_id; end if;
    end;
  end loop;

  guest_participant_id := gen_random_uuid();
  insert into public.event_participants (
    id, event_id, guest_display_name, dinner_response, actual_dinner, actual_football,
    created_by, created_at, updated_at
  ) values (
    guest_participant_id, test_event_id, 'Martín invitado', 'YES', 'YES', 'NO',
    admin_profile_id, now() + interval '20 seconds', now() + interval '20 seconds'
  );

  first_expense_id := gen_random_uuid();
  insert into public.dinner_expenses (
    id, event_id, description, amount_minor, created_by
  ) values
    (first_expense_id, test_event_id, 'Carne', 5000000, admin_profile_id),
    (gen_random_uuid(), test_event_id, 'Verduras', 1000000, admin_profile_id),
    (gen_random_uuid(), test_event_id, 'Bebidas', 3000000, admin_profile_id),
    (gen_random_uuid(), test_event_id, 'Pan', 1000000, admin_profile_id),
    (gen_random_uuid(), unrecorded_event_id, 'Cena', 10000, admin_profile_id),
    (gen_random_uuid(), zero_diners_event_id, 'Cena', 10000, admin_profile_id);

  insert into public.event_participants (
    id, event_id, group_member_id, actual_dinner, actual_football
  ) values (
    match_final_participant_id, match_final_event_id, admin_member_id, 'YES', 'YES'
  );
  insert into public.match_settlements (
    id, event_id, court_amount_minor, currency_code, actual_player_count,
    total_allocated_minor, finalized_by
  ) values (
    match_settlement_id, match_final_event_id, 123400, 'ARS', 1, 123400, admin_profile_id
  );
  insert into public.match_settlement_items (
    match_settlement_id, event_id, event_participant_id, participant_display_name,
    is_guest, amount_minor, allocation_order
  ) values (
    match_settlement_id, match_final_event_id, match_final_participant_id,
    'Admin test', false, 123400, 0
  );
  insert into public.dinner_expenses (event_id, description, amount_minor, created_by)
  values (match_final_event_id, 'Dinner independent', 50000, admin_profile_id);
  insert into public.event_participants (event_id, group_member_id, actual_dinner)
  values (zero_expenses_event_id, admin_member_id, 'YES');

  select settlement.id into target_dinner_settlement_id
  from jsonb_populate_record(
    null::public.dinner_settlements,
    private.finalize_dinner_settlement(test_event_id)->'settlement'
  ) as settlement;

  select count(*), sum(item.amount_minor),
    count(*) filter (where item.amount_minor = 909091),
    count(*) filter (where item.amount_minor = 909090)
  into item_count, allocated_total, high_count, low_count
  from public.dinner_settlement_items as item
  where item.dinner_settlement_id = target_dinner_settlement_id;

  if item_count <> 11 or allocated_total <> 10000000 or high_count <> 10 or low_count <> 1 then
    raise exception 'DINNER_SETTLEMENT_EXACT_ALLOCATION_FAILED';
  end if;
  if exists (
    select 1 from public.dinner_settlement_items as item
    where item.dinner_settlement_id = target_dinner_settlement_id
      and item.event_participant_id = lucas_participant_id
  ) then raise exception 'DINNER_SETTLEMENT_INCLUDED_ACTUAL_NO'; end if;
  if not exists (
    select 1 from public.dinner_settlement_items as item
    where item.dinner_settlement_id = target_dinner_settlement_id
      and item.event_participant_id = guest_participant_id
  ) then raise exception 'DINNER_SETTLEMENT_EXCLUDED_GUEST'; end if;

  select count(*), count(*) filter (where participant.actual_football = 'YES')
  into item_count, football_yes_count
  from public.event_participants as participant
  where participant.event_id = test_event_id;
  select court_price_minor into court_price from public.events where id = test_event_id;
  select count(*) into match_count from public.match_settlements where event_id = test_event_id;
  if item_count <> 12 or football_yes_count <> 2 or court_price <> 777700 or match_count <> 0 then
    raise exception 'DINNER_SETTLEMENT_CHANGED_MATCH_DOMAIN';
  end if;

  perform private.finalize_dinner_settlement(test_event_id);
  if (select count(*) from public.dinner_settlements where event_id = test_event_id) <> 1
    or (select count(*) from public.dinner_settlement_items
        where dinner_settlement_id = target_dinner_settlement_id) <> 11 then
    raise exception 'DINNER_SETTLEMENT_NOT_IDEMPOTENT';
  end if;

  select count(*) into payment_count from public.payments where event_id = test_event_id;
  if payment_count <> 0 then raise exception 'DINNER_SETTLEMENT_CREATED_PAYMENTS'; end if;

  if (private.get_dinner_settlement(match_final_event_id)->>'canFinalize')::boolean is not true then
    raise exception 'MATCH_FINAL_BLOCKED_DINNER_PREVIEW';
  end if;
  if exists (select 1 from public.dinner_settlements where event_id = match_final_event_id) then
    raise exception 'MATCH_FINAL_AUTO_FINALIZED_DINNER';
  end if;

  caught := false;
  begin perform private.finalize_dinner_settlement(unrecorded_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_ATTENDANCE_NOT_RECORDED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_UNRECORDED_NOT_REJECTED'; end if;

  caught := false;
  begin perform private.finalize_dinner_settlement(zero_diners_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_NO_ACTUAL_DINERS'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_ZERO_DINERS_NOT_REJECTED'; end if;

  caught := false;
  begin perform private.finalize_dinner_settlement(zero_expenses_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_NO_EXPENSES'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_ZERO_EXPENSES_NOT_REJECTED'; end if;

  caught := false;
  begin update public.event_participants set actual_dinner = 'NO' where id = first_diner_id;
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_SOURCE_LOCKED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_ATTENDANCE_NOT_LOCKED'; end if;

  caught := false;
  begin insert into public.dinner_expenses (event_id, description, amount_minor, created_by)
    values (test_event_id, 'Late', 100, admin_profile_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_SOURCE_LOCKED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_EXPENSE_INSERT_NOT_LOCKED'; end if;

  caught := false;
  begin update public.dinner_expenses set amount_minor = amount_minor + 1 where id = first_expense_id;
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_SOURCE_LOCKED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_EXPENSE_UPDATE_NOT_LOCKED'; end if;

  caught := false;
  begin delete from public.dinner_expenses where id = first_expense_id;
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_SOURCE_LOCKED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_EXPENSE_DELETE_NOT_LOCKED'; end if;

  update public.group_members set role = 'MEMBER' where id = admin_member_id;
  caught := false;
  begin perform private.finalize_dinner_settlement(test_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_ADMIN_REQUIRED'; end;
  if not caught then raise exception 'DINNER_MANAGER_OWNER_DINER_FINALIZED'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  caught := false;
  begin perform private.get_dinner_settlement(test_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_ACCESS_DENIED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_UNRELATED_READ'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  caught := false;
  begin perform private.get_dinner_settlement(test_event_id);
  exception when others then caught := sqlerrm = 'DINNER_SETTLEMENT_AUTH_REQUIRED'; end;
  if not caught then raise exception 'DINNER_SETTLEMENT_ANON_READ'; end if;
end;
$$;

rollback;
