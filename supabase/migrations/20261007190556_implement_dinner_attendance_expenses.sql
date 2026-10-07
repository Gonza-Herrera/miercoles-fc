alter table public.events
add column dinner_attendance_recorded_at timestamptz,
add column dinner_attendance_recorded_by uuid references public.profiles (id) on delete restrict,
add constraint events_dinner_attendance_recording_complete check (
  (dinner_attendance_recorded_at is null) = (dinner_attendance_recorded_by is null)
);

create index events_dinner_attendance_recorded_by_idx
on public.events (dinner_attendance_recorded_by)
where dinner_attendance_recorded_by is not null;

alter table public.dinner_expenses
add constraint dinner_expenses_description_length check (
  char_length(btrim(description)) between 1 and 120
),
add constraint dinner_expenses_amount_safe_integer check (
  amount_minor <= 9007199254740991
);

create function private.get_dinner_reality(p_event_id uuid)
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
    raise exception using errcode = '42501', message = 'DINNER_REALITY_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_REALITY_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_ACCESS_DENIED';
  end if;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'currencyCode', target_event.currency_code,
    'canEdit', private.is_group_admin(target_event.group_id)
      and target_event.status in (
        'IN_PROGRESS'::public.event_status,
        'SETTLEMENT'::public.event_status
      ),
    'attendanceRecorded', target_event.dinner_attendance_recorded_at is not null,
    'attendanceRecordedAt', target_event.dinner_attendance_recorded_at,
    'actualDinerCount', (
      select count(*)
      from public.event_participants as participant
      where participant.event_id = target_event.id
        and participant.cancelled_at is null
        and participant.actual_dinner = 'YES'::public.actual_attendance_status
    ),
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'participantId', candidate.participant_id,
          'groupMemberId', candidate.group_member_id,
          'displayName', candidate.display_name,
          'avatarPath', candidate.avatar_path,
          'isGuest', candidate.is_guest,
          'dinnerConfirmation', candidate.dinner_response,
          'actualDinnerAttendance', candidate.actual_dinner
        )
        order by
          case candidate.dinner_response
            when 'YES'::public.attendance_response then 0
            when 'UNKNOWN'::public.attendance_response then 1
            else 2
          end,
          candidate.is_guest,
          candidate.display_name,
          candidate.participant_id
      )
      from (
        select
          participant.id as participant_id,
          member.id as group_member_id,
          member.display_name,
          member.avatar_url as avatar_path,
          false as is_guest,
          coalesce(
            participant.dinner_response,
            'UNKNOWN'::public.attendance_response
          ) as dinner_response,
          coalesce(
            participant.actual_dinner,
            'UNSET'::public.actual_attendance_status
          ) as actual_dinner
        from public.group_members as member
        left join public.event_participants as participant
          on participant.event_id = target_event.id
          and participant.group_member_id = member.id
        where member.group_id = target_event.group_id
          and member.deactivated_at is null

        union all

        select
          participant.id,
          null::uuid,
          participant.guest_display_name,
          null::text,
          true,
          participant.dinner_response,
          participant.actual_dinner
        from public.event_participants as participant
        where participant.event_id = target_event.id
          and participant.group_member_id is null
          and participant.cancelled_at is null
      ) as candidate
    ), '[]'::jsonb),
    'expenses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', expense.id,
          'eventId', expense.event_id,
          'description', expense.description,
          'amountMinor', expense.amount_minor,
          'createdAt', expense.created_at,
          'updatedAt', expense.updated_at
        ) order by expense.created_at, expense.id
      )
      from public.dinner_expenses as expense
      where expense.event_id = target_event.id
    ), '[]'::jsonb),
    'totalExpenseMinor', coalesce((
      select sum(expense.amount_minor)
      from public.dinner_expenses as expense
      where expense.event_id = target_event.id
    ), 0::bigint)
  );
end;
$$;

create function public.get_dinner_reality(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_dinner_reality(p_event_id); $$;

create function private.record_dinner_attendance(
  p_event_id uuid,
  p_attendances jsonb,
  p_expected_recorded_at timestamptz default null
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
  item jsonb;
  item_group_member_id uuid;
  item_participant_id uuid;
  item_attended boolean;
  expected_candidate_count integer;
  seen_group_member_ids uuid[] := '{}';
  seen_guest_ids uuid[] := '{}';
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_AUTH_REQUIRED';
  end if;
  if p_attendances is null or jsonb_typeof(p_attendances) <> 'array' then
    raise exception using errcode = '22023', message = 'DINNER_REALITY_ATTENDANCE_INVALID';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
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
  if target_event.dinner_attendance_recorded_at is distinct from p_expected_recorded_at then
    raise exception using errcode = '40001', message = 'DINNER_REALITY_ATTENDANCE_CONFLICT';
  end if;

  select
    (select count(*) from public.group_members as member
      where member.group_id = target_event.group_id and member.deactivated_at is null)
    +
    (select count(*) from public.event_participants as participant
      where participant.event_id = target_event.id
        and participant.group_member_id is null
        and participant.cancelled_at is null)
  into expected_candidate_count;

  if jsonb_array_length(p_attendances) <> expected_candidate_count then
    raise exception using errcode = '22023', message = 'DINNER_REALITY_ATTENDANCE_INCOMPLETE';
  end if;

  for item in select value from jsonb_array_elements(p_attendances)
  loop
    if jsonb_typeof(item) <> 'object' or not (item ? 'attended') then
      raise exception using errcode = '22023', message = 'DINNER_REALITY_ATTENDANCE_INVALID';
    end if;

    begin
      item_group_member_id := nullif(item->>'groupMemberId', '')::uuid;
      item_participant_id := nullif(item->>'participantId', '')::uuid;
      item_attended := (item->>'attended')::boolean;
    exception when others then
      raise exception using errcode = '22023', message = 'DINNER_REALITY_ATTENDANCE_INVALID';
    end;

    if item_attended is null then
      raise exception using errcode = '22023', message = 'DINNER_REALITY_ATTENDANCE_INVALID';
    end if;

    if item_group_member_id is not null then
      if item_group_member_id = any(seen_group_member_ids) or not exists (
        select 1 from public.group_members as member
        where member.id = item_group_member_id
          and member.group_id = target_event.group_id
          and member.deactivated_at is null
      ) then
        raise exception using errcode = '22023', message = 'DINNER_REALITY_PARTICIPANT_INVALID';
      end if;
      if item_participant_id is not null and not exists (
        select 1 from public.event_participants as participant
        where participant.id = item_participant_id
          and participant.event_id = target_event.id
          and participant.group_member_id = item_group_member_id
      ) then
        raise exception using errcode = '22023', message = 'DINNER_REALITY_PARTICIPANT_INVALID';
      end if;

      seen_group_member_ids := array_append(seen_group_member_ids, item_group_member_id);
      insert into public.event_participants (event_id, group_member_id, actual_dinner)
      values (
        target_event.id,
        item_group_member_id,
        case when item_attended then 'YES' else 'NO' end::public.actual_attendance_status
      )
      on conflict (event_id, group_member_id)
      do update set actual_dinner = excluded.actual_dinner;
    elsif item_participant_id is not null then
      if item_participant_id = any(seen_guest_ids) or not exists (
        select 1 from public.event_participants as participant
        where participant.id = item_participant_id
          and participant.event_id = target_event.id
          and participant.group_member_id is null
          and participant.cancelled_at is null
      ) then
        raise exception using errcode = '22023', message = 'DINNER_REALITY_PARTICIPANT_INVALID';
      end if;

      seen_guest_ids := array_append(seen_guest_ids, item_participant_id);
      update public.event_participants
      set actual_dinner = case
        when item_attended then 'YES' else 'NO'
      end::public.actual_attendance_status
      where id = item_participant_id and event_id = target_event.id;
    else
      raise exception using errcode = '22023', message = 'DINNER_REALITY_PARTICIPANT_INVALID';
    end if;
  end loop;

  update public.events
  set
    dinner_attendance_recorded_at = pg_catalog.statement_timestamp(),
    dinner_attendance_recorded_by = caller_profile_id
  where id = target_event.id;

  return private.get_dinner_reality(target_event.id);
end;
$$;

create function public.record_dinner_attendance(
  p_event_id uuid,
  p_attendances jsonb,
  p_expected_recorded_at timestamptz default null
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select private.record_dinner_attendance(
    p_event_id,
    p_attendances,
    p_expected_recorded_at
  );
$$;

create function private.assert_dinner_reality_write_allowed(target_event public.events)
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
end;
$$;

create function private.create_dinner_expense(
  p_event_id uuid,
  p_description text,
  p_amount_minor bigint
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
  normalized_description text := pg_catalog.btrim(p_description);
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_AUTH_REQUIRED';
  end if;
  if normalized_description is null
    or char_length(normalized_description) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_DESCRIPTION_INVALID';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 9007199254740991 then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_AMOUNT_INVALID';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  perform private.assert_dinner_reality_write_allowed(target_event);

  insert into public.dinner_expenses (
    event_id, description, amount_minor, paid_by_group_member_id, created_by
  ) values (
    target_event.id, normalized_description, p_amount_minor, null, caller_profile_id
  );

  return private.get_dinner_reality(target_event.id);
end;
$$;

create function public.create_dinner_expense(
  p_event_id uuid,
  p_description text,
  p_amount_minor bigint
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select private.create_dinner_expense(p_event_id, p_description, p_amount_minor);
$$;

create function private.update_dinner_expense(
  p_event_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_expense public.dinner_expenses%rowtype;
  normalized_description text := pg_catalog.btrim(p_description);
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_AUTH_REQUIRED';
  end if;
  if normalized_description is null
    or char_length(normalized_description) not between 1 and 120 then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_DESCRIPTION_INVALID';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 9007199254740991 then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_AMOUNT_INVALID';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_VERSION_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  perform private.assert_dinner_reality_write_allowed(target_event);

  select expense.* into target_expense
  from public.dinner_expenses as expense
  where expense.id = p_expense_id
    and expense.event_id = target_event.id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_EXPENSE_NOT_FOUND';
  end if;
  if target_expense.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'DINNER_EXPENSE_CONFLICT';
  end if;

  update public.dinner_expenses
  set description = normalized_description, amount_minor = p_amount_minor
  where id = target_expense.id;

  return private.get_dinner_reality(target_event.id);
end;
$$;

create function public.update_dinner_expense(
  p_event_id uuid,
  p_expense_id uuid,
  p_description text,
  p_amount_minor bigint,
  p_expected_updated_at timestamptz
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select private.update_dinner_expense(
    p_event_id,
    p_expense_id,
    p_description,
    p_amount_minor,
    p_expected_updated_at
  );
$$;

create function private.delete_dinner_expense(
  p_event_id uuid,
  p_expense_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_expense public.dinner_expenses%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DINNER_REALITY_AUTH_REQUIRED';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'DINNER_EXPENSE_VERSION_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  perform private.assert_dinner_reality_write_allowed(target_event);

  select expense.* into target_expense
  from public.dinner_expenses as expense
  where expense.id = p_expense_id
    and expense.event_id = target_event.id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_EXPENSE_NOT_FOUND';
  end if;
  if target_expense.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'DINNER_EXPENSE_CONFLICT';
  end if;

  delete from public.dinner_expenses where id = target_expense.id;
  return private.get_dinner_reality(target_event.id);
end;
$$;

create function public.delete_dinner_expense(
  p_event_id uuid,
  p_expense_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select private.delete_dinner_expense(
    p_event_id,
    p_expense_id,
    p_expected_updated_at
  );
$$;

revoke all on function private.get_dinner_reality(uuid) from public, anon, authenticated;
revoke all on function public.get_dinner_reality(uuid) from public, anon, authenticated;
revoke all on function private.record_dinner_attendance(uuid, jsonb, timestamptz)
from public, anon, authenticated;
revoke all on function public.record_dinner_attendance(uuid, jsonb, timestamptz)
from public, anon, authenticated;
revoke all on function private.assert_dinner_reality_write_allowed(public.events)
from public, anon, authenticated;
revoke all on function private.create_dinner_expense(uuid, text, bigint)
from public, anon, authenticated;
revoke all on function public.create_dinner_expense(uuid, text, bigint)
from public, anon, authenticated;
revoke all on function private.update_dinner_expense(uuid, uuid, text, bigint, timestamptz)
from public, anon, authenticated;
revoke all on function public.update_dinner_expense(uuid, uuid, text, bigint, timestamptz)
from public, anon, authenticated;
revoke all on function private.delete_dinner_expense(uuid, uuid, timestamptz)
from public, anon, authenticated;
revoke all on function public.delete_dinner_expense(uuid, uuid, timestamptz)
from public, anon, authenticated;

grant execute on function private.get_dinner_reality(uuid) to authenticated;
grant execute on function public.get_dinner_reality(uuid) to authenticated;
grant execute on function private.record_dinner_attendance(uuid, jsonb, timestamptz)
to authenticated;
grant execute on function public.record_dinner_attendance(uuid, jsonb, timestamptz)
to authenticated;
grant execute on function private.create_dinner_expense(uuid, text, bigint) to authenticated;
grant execute on function public.create_dinner_expense(uuid, text, bigint) to authenticated;
grant execute on function private.update_dinner_expense(uuid, uuid, text, bigint, timestamptz)
to authenticated;
grant execute on function public.update_dinner_expense(uuid, uuid, text, bigint, timestamptz)
to authenticated;
grant execute on function private.delete_dinner_expense(uuid, uuid, timestamptz)
to authenticated;
grant execute on function public.delete_dinner_expense(uuid, uuid, timestamptz)
to authenticated;
