create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

create type public.group_member_role as enum ('ADMIN', 'MEMBER');
create type public.event_status as enum ('DRAFT', 'OPEN', 'IN_PROGRESS', 'SETTLEMENT', 'CLOSED');
create type public.attendance_response as enum ('UNKNOWN', 'YES', 'NO');
create type public.actual_attendance_status as enum ('UNSET', 'YES', 'NO');
create type public.payment_category as enum ('COURT', 'DINNER');
create type public.payment_status as enum ('PENDING', 'PAID');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_timestamp_order check (updated_at >= created_at)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  description text,
  avatar_url text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_timestamp_order check (updated_at >= created_at)
);

create index groups_created_by_idx on public.groups (created_by);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (btrim(display_name) <> ''),
  nickname text,
  avatar_url text,
  role public.group_member_role not null default 'MEMBER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_members_id_group_unique unique (id, group_id),
  constraint group_members_timestamp_order check (updated_at >= created_at)
);

create unique index group_members_group_profile_unique
  on public.group_members (group_id, profile_id)
  where profile_id is not null;
create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_profile_id_idx
  on public.group_members (profile_id)
  where profile_id is not null;

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  group_member_id uuid not null,
  token_hash bytea not null unique,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint group_invitations_member_group_fk
    foreign key (group_member_id, group_id)
    references public.group_members (id, group_id)
    on delete restrict,
  constraint group_invitations_token_hash_length check (octet_length(token_hash) = 32),
  constraint group_invitations_expires_after_creation
    check (expires_at is null or expires_at > created_at),
  constraint group_invitations_single_terminal_state
    check (accepted_at is null or revoked_at is null)
);

create unique index group_invitations_one_active_per_member
  on public.group_invitations (group_member_id)
  where accepted_at is null and revoked_at is null;
create index group_invitations_group_id_idx on public.group_invitations (group_id);
create index group_invitations_created_by_idx on public.group_invitations (created_by);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  title text,
  starts_at timestamptz not null,
  location text,
  court_price_minor bigint check (court_price_minor is null or court_price_minor >= 0),
  currency_code text not null default 'ARS' check (currency_code ~ '^[A-Z]{3}$'),
  status public.event_status not null default 'DRAFT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_timestamp_order check (updated_at >= created_at)
);

create index events_group_id_starts_at_idx on public.events (group_id, starts_at desc);
create index events_created_by_idx on public.events (created_by);

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  group_member_id uuid references public.group_members (id) on delete restrict,
  guest_display_name text,
  football_response public.attendance_response not null default 'UNKNOWN',
  dinner_response public.attendance_response not null default 'UNKNOWN',
  actual_football public.actual_attendance_status not null default 'UNSET',
  actual_dinner public.actual_attendance_status not null default 'UNSET',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_participants_id_event_unique unique (id, event_id),
  constraint event_participants_member_once unique (event_id, group_member_id),
  constraint event_participants_identity check (
    (group_member_id is not null and guest_display_name is null)
    or
    (group_member_id is null and guest_display_name is not null and btrim(guest_display_name) <> '')
  ),
  constraint event_participants_timestamp_order check (updated_at >= created_at)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  name text not null check (btrim(name) <> ''),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_id_event_unique unique (id, event_id),
  constraint teams_event_name_unique unique (event_id, name),
  constraint teams_event_position_unique unique (event_id, position),
  constraint teams_timestamp_order check (updated_at >= created_at)
);

create index event_participants_group_member_id_idx
  on public.event_participants (group_member_id)
  where group_member_id is not null;

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  event_participant_id uuid not null,
  created_at timestamptz not null default now(),
  constraint team_members_team_event_fk
    foreign key (team_id, event_id)
    references public.teams (id, event_id)
    on delete restrict,
  constraint team_members_participant_event_fk
    foreign key (event_participant_id, event_id)
    references public.event_participants (id, event_id)
    on delete restrict,
  constraint team_members_one_team_per_event unique (event_id, event_participant_id)
);

create index team_members_team_id_idx on public.team_members (team_id);
create index team_members_event_participant_id_idx
  on public.team_members (event_participant_id);

create table public.event_managers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null,
  group_member_id uuid not null references public.group_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint event_managers_team_event_fk
    foreign key (team_id, event_id)
    references public.teams (id, event_id)
    on delete restrict,
  constraint event_managers_one_per_team unique (team_id),
  constraint event_managers_one_team_per_member unique (event_id, group_member_id)
);

create table public.dinner_expenses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete restrict,
  description text not null check (btrim(description) <> ''),
  amount_minor bigint not null check (amount_minor > 0),
  paid_by_group_member_id uuid references public.group_members (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinner_expenses_timestamp_order check (updated_at >= created_at)
);

create index dinner_expenses_event_id_idx on public.dinner_expenses (event_id);
create index dinner_expenses_paid_by_group_member_id_idx
  on public.dinner_expenses (paid_by_group_member_id)
  where paid_by_group_member_id is not null;
create index dinner_expenses_created_by_idx on public.dinner_expenses (created_by);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  event_participant_id uuid not null,
  category public.payment_category not null,
  amount_minor bigint not null check (amount_minor >= 0),
  status public.payment_status not null default 'PENDING',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_participant_event_fk
    foreign key (event_participant_id, event_id)
    references public.event_participants (id, event_id)
    on delete restrict,
  constraint payments_participant_category_unique
    unique (event_id, event_participant_id, category),
  constraint payments_paid_at_matches_status check (
    (status = 'PAID' and paid_at is not null)
    or
    (status = 'PENDING' and paid_at is null)
  ),
  constraint payments_timestamp_order check (updated_at >= created_at)
);

create index payments_event_participant_id_idx
  on public.payments (event_participant_id);
create index event_managers_group_member_id_idx
  on public.event_managers (group_member_id);

create function private.assert_member_matches_event_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_group_id uuid;
  member_group_id uuid;
begin
  if new.group_member_id is null then
    return new;
  end if;

  select event_row.group_id into event_group_id
  from public.events as event_row
  where event_row.id = new.event_id;

  select member_row.group_id into member_group_id
  from public.group_members as member_row
  where member_row.id = new.group_member_id;

  if event_group_id is distinct from member_group_id then
    raise exception 'group member must belong to the event group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.assert_expense_payer_matches_event_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_group_id uuid;
  member_group_id uuid;
begin
  if new.paid_by_group_member_id is null then
    return new;
  end if;

  select event_row.group_id into event_group_id
  from public.events as event_row
  where event_row.id = new.event_id;

  select member_row.group_id into member_group_id
  from public.group_members as member_row
  where member_row.id = new.paid_by_group_member_id;

  if event_group_id is distinct from member_group_id then
    raise exception 'expense payer must belong to the event group'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger event_participants_member_group_guard
before insert or update of event_id, group_member_id on public.event_participants
for each row execute function private.assert_member_matches_event_group();

create trigger event_managers_member_group_guard
before insert or update of event_id, group_member_id on public.event_managers
for each row execute function private.assert_member_matches_event_group();

create trigger dinner_expenses_payer_group_guard
before insert or update of event_id, paid_by_group_member_id on public.dinner_expenses
for each row execute function private.assert_expense_payer_matches_event_group();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger groups_set_updated_at
before update on public.groups
for each row execute function private.set_updated_at();
create trigger group_members_set_updated_at
before update on public.group_members
for each row execute function private.set_updated_at();
create trigger events_set_updated_at
before update on public.events
for each row execute function private.set_updated_at();
create trigger event_participants_set_updated_at
before update on public.event_participants
for each row execute function private.set_updated_at();
create trigger teams_set_updated_at
before update on public.teams
for each row execute function private.set_updated_at();
create trigger dinner_expenses_set_updated_at
before update on public.dinner_expenses
for each row execute function private.set_updated_at();
create trigger payments_set_updated_at
before update on public.payments
for each row execute function private.set_updated_at();

create function private.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.group_members as membership
      where membership.group_id = target_group_id
        and membership.profile_id = (select auth.uid())
    );
$$;

create function private.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.group_members as membership
      where membership.group_id = target_group_id
        and membership.profile_id = (select auth.uid())
        and membership.role = 'ADMIN'
    );
$$;

create function private.can_access_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events as event_row
    where event_row.id = target_event_id
      and private.is_group_member(event_row.group_id)
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.assert_member_matches_event_group() from public;
revoke all on function private.assert_expense_payer_matches_event_group() from public;
revoke all on function private.is_group_member(uuid) from public;
revoke all on function private.is_group_admin(uuid) from public;
revoke all on function private.can_access_event(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_admin(uuid) to authenticated;
grant execute on function private.can_access_event(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.event_managers enable row level security;
alter table public.dinner_expenses enable row level security;
alter table public.payments enable row level security;

create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "groups_select_linked_members"
on public.groups for select
to authenticated
using (private.is_group_member(id));

create policy "group_members_select_linked_members"
on public.group_members for select
to authenticated
using (private.is_group_member(group_id));

create policy "group_invitations_select_group_admins"
on public.group_invitations for select
to authenticated
using (private.is_group_admin(group_id));

create policy "events_select_linked_members"
on public.events for select
to authenticated
using (private.is_group_member(group_id));

create policy "event_participants_select_linked_members"
on public.event_participants for select
to authenticated
using (private.can_access_event(event_id));

create policy "teams_select_linked_members"
on public.teams for select
to authenticated
using (private.can_access_event(event_id));

create policy "team_members_select_linked_members"
on public.team_members for select
to authenticated
using (private.can_access_event(event_id));

create policy "event_managers_select_linked_members"
on public.event_managers for select
to authenticated
using (private.can_access_event(event_id));

create policy "dinner_expenses_select_linked_members"
on public.dinner_expenses for select
to authenticated
using (private.can_access_event(event_id));

create policy "payments_select_linked_members"
on public.payments for select
to authenticated
using (private.can_access_event(event_id));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.groups from anon, authenticated;
revoke all on table public.group_members from anon, authenticated;
revoke all on table public.group_invitations from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.event_participants from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_members from anon, authenticated;
revoke all on table public.event_managers from anon, authenticated;
revoke all on table public.dinner_expenses from anon, authenticated;
revoke all on table public.payments from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url) on table public.profiles to authenticated;
grant select on table public.groups to authenticated;
grant select on table public.group_members to authenticated;
grant select on table public.group_invitations to authenticated;
grant select on table public.events to authenticated;
grant select on table public.event_participants to authenticated;
grant select on table public.teams to authenticated;
grant select on table public.team_members to authenticated;
grant select on table public.event_managers to authenticated;
grant select on table public.dinner_expenses to authenticated;
grant select on table public.payments to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.groups to service_role;
grant all on table public.group_members to service_role;
grant all on table public.group_invitations to service_role;
grant all on table public.events to service_role;
grant all on table public.event_participants to service_role;
grant all on table public.teams to service_role;
grant all on table public.team_members to service_role;
grant all on table public.event_managers to service_role;
grant all on table public.dinner_expenses to service_role;
grant all on table public.payments to service_role;
