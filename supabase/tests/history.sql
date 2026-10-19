begin;

do $$
declare
  admin_profile_id uuid;
  test_group_id uuid := gen_random_uuid();
  other_group_id uuid := gen_random_uuid();
  event_ids uuid[] := array[]::uuid[];
  target_event_id uuid;
  page_one jsonb;
  page_two jsonb;
  item jsonb;
  caught boolean := false;
begin
  select profile.id into admin_profile_id
  from public.profiles as profile order by profile.created_at, profile.id limit 1;
  if admin_profile_id is null then raise exception 'HISTORY_TEST_REQUIRES_PROFILE'; end if;
  perform set_config('request.jwt.claim.sub', admin_profile_id::text, true);

  insert into public.groups (id, name, created_by) values
    (test_group_id, 'PR25 History', admin_profile_id),
    (other_group_id, 'Other History', admin_profile_id);
  insert into public.group_members (group_id, profile_id, display_name, role)
  values (test_group_id, admin_profile_id, 'History Admin', 'ADMIN');

  for index_value in 1..12 loop
    target_event_id := gen_random_uuid();
    event_ids := array_append(event_ids, target_event_id);
    insert into public.events (
      id, group_id, created_by, starts_at, location, court_price_minor,
      currency_code, status, closed_at, closed_by
    ) values (
      target_event_id, test_group_id, admin_profile_id,
      timestamptz '2026-09-30 21:00:00-03' - ((index_value - 1) * interval '7 days'),
      'Court', 0, 'ARS', 'CLOSED', now(), admin_profile_id
    );
  end loop;

  insert into public.events (group_id, created_by, starts_at, location, court_price_minor, currency_code, status)
  values
    (test_group_id, admin_profile_id, now(), 'Draft', 0, 'ARS', 'DRAFT'),
    (test_group_id, admin_profile_id, now(), 'Open', 0, 'ARS', 'OPEN'),
    (test_group_id, admin_profile_id, now(), 'Progress', 0, 'ARS', 'IN_PROGRESS'),
    (test_group_id, admin_profile_id, now(), 'Settlement', 0, 'ARS', 'SETTLEMENT');

  insert into public.event_participants (
    event_id, guest_display_name, football_response, dinner_response,
    actual_football, actual_dinner, created_by
  ) values
    (event_ids[1], 'Actual guest', 'YES', 'YES', 'YES', 'YES', admin_profile_id),
    (event_ids[1], 'Planned only', 'YES', 'YES', 'NO', 'NO', admin_profile_id);

  page_one := private.get_group_event_history(test_group_id, null, null, 10);
  if jsonb_array_length(page_one->'items') <> 10
    or not (page_one->>'hasMore')::boolean
    or page_one #>> '{items,0,eventId}' <> event_ids[1]::text
    or page_one #>> '{items,0,actualPlayerCount}' <> '1'
    or page_one #>> '{items,0,actualDinerCount}' <> '1'
  then raise exception 'HISTORY_FIRST_PAGE_INVALID'; end if;

  for item in select * from jsonb_array_elements(page_one->'items') loop
    if item->>'status' <> 'CLOSED' or item->>'groupId' <> test_group_id::text then
      raise exception 'HISTORY_FILTER_INVALID';
    end if;
  end loop;

  page_two := private.get_group_event_history(
    test_group_id,
    (page_one #>> '{nextCursor,startsAt}')::timestamptz,
    (page_one #>> '{nextCursor,eventId}')::uuid,
    10
  );
  if jsonb_array_length(page_two->'items') <> 2
    or (page_two->>'hasMore')::boolean
    or exists (
      select 1 from jsonb_array_elements(page_one->'items') first_page
      join jsonb_array_elements(page_two->'items') second_page
        on first_page->>'eventId' = second_page->>'eventId'
    )
  then raise exception 'HISTORY_PAGINATION_INVALID'; end if;

  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  begin
    perform private.get_group_event_history(test_group_id, null, null, 10);
  exception when others then caught := sqlerrm = 'HISTORY_ACCESS_DENIED'; end;
  if not caught then raise exception 'HISTORY_CROSS_GROUP_ACCESS_ALLOWED'; end if;

  perform set_config('request.jwt.claim.sub', '', true);
  caught := false;
  begin
    perform private.get_group_event_history(test_group_id, null, null, 10);
  exception when others then caught := sqlerrm = 'HISTORY_AUTH_REQUIRED'; end;
  if not caught then raise exception 'HISTORY_ANON_ACCESS_ALLOWED'; end if;
end;
$$;

rollback;
