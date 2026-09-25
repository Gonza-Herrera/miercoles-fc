alter table public.events
  alter column location set not null,
  alter column court_price_minor set not null;

alter table public.events
  add constraint events_title_length check (
    title is null
    or (char_length(btrim(title)) between 1 and 100)
  ),
  add constraint events_location_length check (
    char_length(btrim(location)) between 1 and 200
  );

create index events_active_group_starts_at_idx
on public.events (group_id, starts_at)
where status <> 'CLOSED'::public.event_status;

create function private.enforce_event_lifecycle()
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

  if old.status in (
    'IN_PROGRESS'::public.event_status,
    'SETTLEMENT'::public.event_status
  ) and (
    new.starts_at is distinct from old.starts_at
    or new.location is distinct from old.location
    or new.currency_code is distinct from old.currency_code
    or new.title is distinct from old.title
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_SCHEDULE_LOCKED';
  end if;

  return new;
end;
$$;

create trigger events_enforce_lifecycle
before update on public.events
for each row execute function private.enforce_event_lifecycle();

create function private.create_event(
  p_group_id uuid,
  p_starts_at timestamptz,
  p_location text,
  p_court_price_minor bigint
)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  normalized_location text := pg_catalog.btrim(p_location);
  created_event public.events%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'EVENT_AUTH_REQUIRED';
  end if;

  if not private.is_group_admin(p_group_id) then
    raise exception using errcode = '42501', message = 'EVENT_ADMIN_REQUIRED';
  end if;

  if p_starts_at is null then
    raise exception using errcode = '22023', message = 'EVENT_START_INVALID';
  end if;

  if normalized_location is null or normalized_location = '' or char_length(normalized_location) > 200 then
    raise exception using errcode = '22023', message = 'EVENT_LOCATION_INVALID';
  end if;

  if p_court_price_minor is null or p_court_price_minor < 0 then
    raise exception using errcode = '22023', message = 'EVENT_PRICE_INVALID';
  end if;

  insert into public.events (
    group_id,
    created_by,
    starts_at,
    location,
    court_price_minor,
    currency_code,
    status
  )
  values (
    p_group_id,
    caller_profile_id,
    p_starts_at,
    normalized_location,
    p_court_price_minor,
    'ARS',
    'DRAFT'::public.event_status
  )
  returning * into created_event;

  return created_event;
end;
$$;

create function private.update_event_details(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_location text,
  p_court_price_minor bigint
)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  normalized_location text := pg_catalog.btrim(p_location);
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'EVENT_AUTH_REQUIRED';
  end if;

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'EVENT_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'EVENT_ADMIN_REQUIRED';
  end if;

  if target_event.status = 'CLOSED'::public.event_status then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSED';
  end if;

  if p_starts_at is null then
    raise exception using errcode = '22023', message = 'EVENT_START_INVALID';
  end if;

  if normalized_location is null or normalized_location = '' or char_length(normalized_location) > 200 then
    raise exception using errcode = '22023', message = 'EVENT_LOCATION_INVALID';
  end if;

  if p_court_price_minor is null or p_court_price_minor < 0 then
    raise exception using errcode = '22023', message = 'EVENT_PRICE_INVALID';
  end if;

  if target_event.status in (
    'IN_PROGRESS'::public.event_status,
    'SETTLEMENT'::public.event_status
  ) and (
    p_starts_at is distinct from target_event.starts_at
    or normalized_location is distinct from target_event.location
  ) then
    raise exception using errcode = 'P0001', message = 'EVENT_SCHEDULE_LOCKED';
  end if;

  update public.events as event_row
  set
    starts_at = p_starts_at,
    location = normalized_location,
    court_price_minor = p_court_price_minor
  where event_row.id = target_event.id
  returning event_row.* into target_event;

  return target_event;
end;
$$;

create function private.transition_event_status(
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

  select event_row.*
  into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'EVENT_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'EVENT_ADMIN_REQUIRED';
  end if;

  if p_target_status is null or not (
    (target_event.status = 'DRAFT'::public.event_status and p_target_status = 'OPEN'::public.event_status)
    or (target_event.status = 'OPEN'::public.event_status and p_target_status = 'IN_PROGRESS'::public.event_status)
    or (target_event.status = 'IN_PROGRESS'::public.event_status and p_target_status = 'SETTLEMENT'::public.event_status)
    or (target_event.status = 'SETTLEMENT'::public.event_status and p_target_status = 'CLOSED'::public.event_status)
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

create function public.create_event(
  p_group_id uuid,
  p_starts_at timestamptz,
  p_location text,
  p_court_price_minor bigint
)
returns public.events
language sql
volatile
set search_path = ''
as $$
  select private.create_event(p_group_id, p_starts_at, p_location, p_court_price_minor);
$$;

create function public.update_event_details(
  p_event_id uuid,
  p_starts_at timestamptz,
  p_location text,
  p_court_price_minor bigint
)
returns public.events
language sql
volatile
set search_path = ''
as $$
  select private.update_event_details(p_event_id, p_starts_at, p_location, p_court_price_minor);
$$;

create function public.transition_event_status(
  p_event_id uuid,
  p_target_status public.event_status
)
returns public.events
language sql
volatile
set search_path = ''
as $$
  select private.transition_event_status(p_event_id, p_target_status);
$$;

revoke all on function private.enforce_event_lifecycle() from public, anon, authenticated;
revoke all on function private.create_event(uuid, timestamptz, text, bigint) from public, anon, authenticated;
revoke all on function private.update_event_details(uuid, timestamptz, text, bigint) from public, anon, authenticated;
revoke all on function private.transition_event_status(uuid, public.event_status) from public, anon, authenticated;

grant execute on function private.create_event(uuid, timestamptz, text, bigint) to authenticated;
grant execute on function private.update_event_details(uuid, timestamptz, text, bigint) to authenticated;
grant execute on function private.transition_event_status(uuid, public.event_status) to authenticated;

revoke all on function public.create_event(uuid, timestamptz, text, bigint) from public, anon, authenticated;
revoke all on function public.update_event_details(uuid, timestamptz, text, bigint) from public, anon, authenticated;
revoke all on function public.transition_event_status(uuid, public.event_status) from public, anon, authenticated;

grant execute on function public.create_event(uuid, timestamptz, text, bigint) to authenticated;
grant execute on function public.update_event_details(uuid, timestamptz, text, bigint) to authenticated;
grant execute on function public.transition_event_status(uuid, public.event_status) to authenticated;
