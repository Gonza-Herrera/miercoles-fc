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
  zero_event_id uuid := gen_random_uuid();
  settlement_id uuid;
  first_participant_id uuid;
  lucas_participant_id uuid;
  guest_participant_id uuid;
  item_count integer;
  high_count integer;
  low_count integer;
  allocated_total bigint;
  payment_count integer;
  caught boolean;
begin
  select profile.id into admin_profile_id
  from public.profiles as profile
  order by profile.created_at, profile.id
  limit 1;

  if admin_profile_id is null then
    raise exception 'MATCH_SETTLEMENT_TEST_REQUIRES_PROFILE';
  end if;

  perform set_config('request.jwt.claim.sub', admin_profile_id::text, true);

  insert into public.groups (id, name, created_by)
  values (test_group_id, 'PR21 transactional test', admin_profile_id);
  insert into public.group_members (id, group_id, profile_id, display_name, role)
  values (admin_member_id, test_group_id, admin_profile_id, 'Admin test', 'ADMIN');
  insert into public.group_members (id, group_id, display_name, role)
  values (backup_admin_id, test_group_id, 'Backup admin', 'ADMIN');

  insert into public.events (
    id, group_id, created_by, starts_at, location, court_price_minor,
    currency_code, status, match_attendance_recorded_at, match_attendance_recorded_by
  ) values
    (test_event_id, test_group_id, admin_profile_id, now(), 'Test court', 5000000,
      'ARS', 'IN_PROGRESS', now(), admin_profile_id),
    (unrecorded_event_id, test_group_id, admin_profile_id, now(), 'Test court', 5000000,
      'ARS', 'SETTLEMENT', null, null),
    (zero_event_id, test_group_id, admin_profile_id, now(), 'Test court', 5000000,
      'ARS', 'SETTLEMENT', now(), admin_profile_id);

  update public.events set team_formation_mode = 'MANAGERS' where id = test_event_id;
  insert into public.teams (id, event_id, name, position)
  values (manager_team_id, test_event_id, 'Team test', 1);
  insert into public.event_managers (event_id, team_id, group_member_id)
  values (test_event_id, manager_team_id, admin_member_id);
  insert into public.dinner_plans (event_id, purchase_owner_group_member_id)
  values (test_event_id, admin_member_id);
  update public.events set status = 'SETTLEMENT' where id = test_event_id;

  for index_value in 1..9 loop
    declare
      member_id uuid := gen_random_uuid();
      participant_id uuid := gen_random_uuid();
      player_name text := case index_value
        when 1 then 'Gonzalo'
        when 2 then 'Lucas'
        when 3 then 'Carla'
        when 4 then 'Matías'
        else 'Player ' || index_value::text
      end;
      response public.attendance_response := case index_value
        when 1 then 'YES'
        when 2 then 'YES'
        when 3 then 'NO'
        when 4 then 'UNKNOWN'
        else 'YES'
      end;
      actual public.actual_attendance_status := case
        when index_value = 2 then 'NO' else 'YES'
      end;
    begin
      insert into public.group_members (id, group_id, display_name)
      values (member_id, test_group_id, player_name);
      insert into public.event_participants (
        id, event_id, group_member_id, football_response, actual_football,
        created_at, updated_at
      ) values (
        participant_id, test_event_id, member_id, response, actual,
        now() + index_value * interval '1 second', now() + index_value * interval '1 second'
      );
      if index_value = 1 then first_participant_id := participant_id; end if;
      if index_value = 2 then lucas_participant_id := participant_id; end if;
    end;
  end loop;

  guest_participant_id := gen_random_uuid();
  insert into public.event_participants (
    id, event_id, guest_display_name, football_response, actual_football,
    created_by, created_at, updated_at
  ) values (
    guest_participant_id, test_event_id, 'Martín invitado', 'YES', 'YES',
    admin_profile_id, now() + interval '20 seconds', now() + interval '20 seconds'
  );

  select settlement.id into settlement_id
  from jsonb_populate_record(
    null::public.match_settlements,
    private.finalize_match_settlement(test_event_id)->'settlement'
  ) as settlement;

  select count(*), sum(item.amount_minor),
    count(*) filter (where item.amount_minor = 555556),
    count(*) filter (where item.amount_minor = 555555)
  into item_count, allocated_total, high_count, low_count
  from public.match_settlement_items as item
  where item.match_settlement_id = settlement_id;

  if item_count <> 9 or allocated_total <> 5000000 or high_count <> 5 or low_count <> 4 then
    raise exception 'MATCH_SETTLEMENT_EXACT_ALLOCATION_FAILED';
  end if;
  if exists (
    select 1 from public.match_settlement_items
    where match_settlement_id = settlement_id and event_participant_id = lucas_participant_id
  ) then raise exception 'MATCH_SETTLEMENT_INCLUDED_ACTUAL_NO'; end if;
  if not exists (
    select 1 from public.match_settlement_items
    where match_settlement_id = settlement_id and event_participant_id = guest_participant_id
  ) then raise exception 'MATCH_SETTLEMENT_EXCLUDED_GUEST'; end if;

  perform private.finalize_match_settlement(test_event_id);
  if (select count(*) from public.match_settlements where event_id = test_event_id) <> 1
    or (select count(*) from public.match_settlement_items where match_settlement_id = settlement_id) <> 9 then
    raise exception 'MATCH_SETTLEMENT_NOT_IDEMPOTENT';
  end if;

  select count(*) into payment_count from public.payments where event_id = test_event_id;
  if payment_count <> 0 then raise exception 'MATCH_SETTLEMENT_CREATED_PAYMENTS'; end if;

  caught := false;
  begin
    perform private.finalize_match_settlement(unrecorded_event_id);
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_ATTENDANCE_NOT_RECORDED';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_UNRECORDED_NOT_REJECTED'; end if;

  caught := false;
  begin
    perform private.finalize_match_settlement(zero_event_id);
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_NO_ACTUAL_PLAYERS';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_ZERO_NOT_REJECTED'; end if;

  caught := false;
  begin
    update public.events set court_price_minor = 6000000 where id = test_event_id;
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_SOURCE_LOCKED';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_PRICE_NOT_LOCKED'; end if;

  caught := false;
  begin
    update public.event_participants set actual_football = 'NO' where id = first_participant_id;
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_SOURCE_LOCKED';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_ATTENDANCE_NOT_LOCKED'; end if;

  update public.group_members set role = 'MEMBER' where id = admin_member_id;
  caught := false;
  begin
    perform private.finalize_match_settlement(test_event_id);
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_ADMIN_REQUIRED';
  end;
  if not caught then
    raise exception 'MATCH_SETTLEMENT_MANAGER_OR_PURCHASE_OWNER_FINALIZED';
  end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  caught := false;
  begin
    perform private.get_match_settlement(test_event_id);
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_ACCESS_DENIED';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_UNRELATED_READ'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  caught := false;
  begin
    perform private.get_match_settlement(test_event_id);
  exception when others then
    caught := sqlerrm = 'MATCH_SETTLEMENT_AUTH_REQUIRED';
  end;
  if not caught then raise exception 'MATCH_SETTLEMENT_ANON_READ'; end if;
end;
$$;

rollback;
