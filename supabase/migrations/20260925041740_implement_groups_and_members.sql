alter table public.group_members
add column deactivated_at timestamptz;

alter table public.groups
add constraint groups_name_length check (char_length(btrim(name)) <= 100),
add constraint groups_description_length check (
  description is null or char_length(description) <= 500
),
add constraint groups_avatar_path check (
  avatar_url is null or avatar_url = 'groups/' || id::text || '/avatar'
);

alter table public.group_members
add constraint group_members_display_name_length check (
  char_length(btrim(display_name)) <= 100
),
add constraint group_members_nickname_length check (
  nickname is null or char_length(nickname) <= 60
),
add constraint group_members_deactivated_after_creation check (
  deactivated_at is null or deactivated_at >= created_at
),
add constraint group_members_avatar_path check (
  avatar_url is null
  or avatar_url = 'members/' || group_id::text || '/' || id::text || '/avatar'
);

create index group_members_active_admin_group_idx
on public.group_members (group_id)
where role = 'ADMIN'::public.group_member_role and deactivated_at is null;

create or replace function private.is_group_member(target_group_id uuid)
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
        and membership.deactivated_at is null
    );
$$;

create or replace function private.is_group_admin(target_group_id uuid)
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
        and membership.role = 'ADMIN'::public.group_member_role
        and membership.deactivated_at is null
    );
$$;

drop policy "group_members_select_linked_members" on public.group_members;
create policy "group_members_select_active_group_members"
on public.group_members for select
to authenticated
using (
  private.is_group_member(group_id)
  and (deactivated_at is null or private.is_group_admin(group_id))
);

create or replace function private.list_invitable_group_members()
returns table (
  group_member_id uuid,
  member_display_name text,
  group_id uuid,
  group_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    target.id,
    target.display_name,
    target.group_id,
    group_row.name
  from public.group_members as target
  join public.groups as group_row on group_row.id = target.group_id
  where (select auth.uid()) is not null
    and target.profile_id is null
    and target.deactivated_at is null
    and exists (
      select 1
      from public.group_members as administrator
      where administrator.group_id = target.group_id
        and administrator.profile_id = (select auth.uid())
        and administrator.role = 'ADMIN'::public.group_member_role
        and administrator.deactivated_at is null
    )
  order by group_row.name, target.display_name, target.id;
$$;

create or replace function private.create_group_invitation(p_group_member_id uuid)
returns table (
  raw_token text,
  expires_at timestamptz,
  group_id uuid,
  group_name text,
  group_member_id uuid,
  member_display_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  invitation_token text;
  invitation_token_hash bytea;
  invitation_expires_at timestamptz := pg_catalog.statement_timestamp() + interval '7 days';
  target_member public.group_members%rowtype;
  target_group_name text;
begin
  if caller_profile_id is null then
    raise exception using errcode = 'P0001', message = 'INVITATION_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles as profile where profile.id = caller_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'INVITATION_PROFILE_REQUIRED';
  end if;

  select member_row.*
  into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'INVITATION_MEMBER_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_member.group_id) then
    raise exception using errcode = '42501', message = 'INVITATION_ADMIN_REQUIRED';
  end if;

  if target_member.deactivated_at is not null then
    raise exception using errcode = 'P0001', message = 'INVITATION_MEMBER_INACTIVE';
  end if;

  if target_member.profile_id is not null then
    raise exception using errcode = 'P0001', message = 'INVITATION_MEMBER_ALREADY_LINKED';
  end if;

  select group_row.name
  into target_group_name
  from public.groups as group_row
  where group_row.id = target_member.group_id;

  update public.group_invitations as previous_invitation
  set revoked_at = pg_catalog.statement_timestamp()
  where previous_invitation.group_member_id = target_member.id
    and previous_invitation.accepted_at is null
    and previous_invitation.revoked_at is null;

  invitation_token := pg_catalog.translate(
    pg_catalog.rtrim(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '='),
    '+/',
    '-_'
  );
  invitation_token_hash := extensions.digest(
    pg_catalog.convert_to(invitation_token, 'UTF8'),
    'sha256'
  );

  insert into public.group_invitations (
    group_id,
    group_member_id,
    token_hash,
    created_by,
    expires_at
  )
  values (
    target_member.group_id,
    target_member.id,
    invitation_token_hash,
    caller_profile_id,
    invitation_expires_at
  );

  return query
  select
    invitation_token,
    invitation_expires_at,
    target_member.group_id,
    target_group_name,
    target_member.id,
    target_member.display_name;
end;
$$;

create or replace function private.revoke_group_invitation(p_group_member_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  target_member public.group_members%rowtype;
begin
  if caller_profile_id is null then
    raise exception using errcode = 'P0001', message = 'INVITATION_AUTH_REQUIRED';
  end if;

  select member_row.*
  into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id
  for update;

  if not found then
    return false;
  end if;

  if not private.is_group_admin(target_member.group_id) then
    raise exception using errcode = '42501', message = 'INVITATION_ADMIN_REQUIRED';
  end if;

  update public.group_invitations as invitation
  set revoked_at = pg_catalog.statement_timestamp()
  where invitation.group_member_id = target_member.id
    and invitation.accepted_at is null
    and invitation.revoked_at is null;

  return found;
end;
$$;

create function private.create_group(p_name text, p_description text default null)
returns table (
  group_id uuid,
  group_name text,
  membership_id uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_profile public.profiles%rowtype;
  created_group public.groups%rowtype;
  created_membership_id uuid;
  normalized_name text := pg_catalog.btrim(p_name);
  normalized_description text := pg_catalog.nullif(pg_catalog.btrim(p_description), '');
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'GROUP_AUTH_REQUIRED';
  end if;

  select profile.* into caller_profile
  from public.profiles as profile
  where profile.id = (select auth.uid());

  if not found then
    raise exception using errcode = 'P0001', message = 'GROUP_PROFILE_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'GROUP_NAME_INVALID';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 500 then
    raise exception using errcode = '22023', message = 'GROUP_DESCRIPTION_INVALID';
  end if;

  insert into public.groups (name, description, created_by)
  values (normalized_name, normalized_description, caller_profile.id)
  returning * into created_group;

  insert into public.group_members (
    group_id,
    profile_id,
    display_name,
    avatar_url,
    role
  )
  values (
    created_group.id,
    caller_profile.id,
    caller_profile.display_name,
    null,
    'ADMIN'::public.group_member_role
  )
  returning id into created_membership_id;

  return query select created_group.id, created_group.name, created_membership_id;
end;
$$;

create function private.update_group(
  p_group_id uuid,
  p_name text,
  p_description text default null
)
returns public.groups
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_name text := pg_catalog.btrim(p_name);
  normalized_description text := pg_catalog.nullif(pg_catalog.btrim(p_description), '');
  updated_group public.groups%rowtype;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'GROUP_NAME_INVALID';
  end if;

  if normalized_description is not null and char_length(normalized_description) > 500 then
    raise exception using errcode = '22023', message = 'GROUP_DESCRIPTION_INVALID';
  end if;

  update public.groups as group_row
  set name = normalized_name, description = normalized_description
  where group_row.id = p_group_id
  returning group_row.* into updated_group;

  if not found then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;

  return updated_group;
end;
$$;

create function private.add_group_member(
  p_group_id uuid,
  p_display_name text,
  p_nickname text default null,
  p_role public.group_member_role default 'MEMBER'::public.group_member_role
)
returns public.group_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_name text := pg_catalog.btrim(p_display_name);
  normalized_nickname text := pg_catalog.nullif(pg_catalog.btrim(p_nickname), '');
  created_member public.group_members%rowtype;
begin
  if not private.is_group_admin(p_group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'MEMBER_NAME_INVALID';
  end if;

  if normalized_nickname is not null and char_length(normalized_nickname) > 60 then
    raise exception using errcode = '22023', message = 'MEMBER_NICKNAME_INVALID';
  end if;

  if p_role is null then
    raise exception using errcode = '22023', message = 'MEMBER_ROLE_INVALID';
  end if;

  insert into public.group_members (group_id, display_name, nickname, role)
  values (p_group_id, normalized_name, normalized_nickname, p_role)
  returning * into created_member;

  return created_member;
end;
$$;

create function private.update_group_member(
  p_group_member_id uuid,
  p_display_name text,
  p_nickname text default null
)
returns public.group_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_member public.group_members%rowtype;
  normalized_name text := pg_catalog.btrim(p_display_name);
  normalized_nickname text := pg_catalog.nullif(pg_catalog.btrim(p_nickname), '');
begin
  select member_row.* into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_member.group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  if normalized_name is null or normalized_name = '' or char_length(normalized_name) > 100 then
    raise exception using errcode = '22023', message = 'MEMBER_NAME_INVALID';
  end if;

  if normalized_nickname is not null and char_length(normalized_nickname) > 60 then
    raise exception using errcode = '22023', message = 'MEMBER_NICKNAME_INVALID';
  end if;

  update public.group_members as member_row
  set display_name = normalized_name, nickname = normalized_nickname
  where member_row.id = p_group_member_id
  returning member_row.* into target_member;

  return target_member;
end;
$$;

create function private.change_group_member_role(
  p_group_member_id uuid,
  p_role public.group_member_role
)
returns public.group_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  target_member public.group_members%rowtype;
begin
  select member_row.group_id into target_group_id
  from public.group_members as member_row
  where member_row.id = p_group_member_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group_id::text, 0));

  if not private.is_group_admin(target_group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  select member_row.* into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id
  for update;

  if target_member.deactivated_at is not null then
    raise exception using errcode = 'P0001', message = 'MEMBER_INACTIVE';
  end if;

  if p_role is null then
    raise exception using errcode = '22023', message = 'MEMBER_ROLE_INVALID';
  end if;

  if target_member.role = 'ADMIN'::public.group_member_role
    and p_role = 'MEMBER'::public.group_member_role
    and not exists (
      select 1 from public.group_members as other_admin
      where other_admin.group_id = target_group_id
        and other_admin.id <> target_member.id
        and other_admin.role = 'ADMIN'::public.group_member_role
        and other_admin.deactivated_at is null
    ) then
    raise exception using errcode = 'P0001', message = 'GROUP_LAST_ADMIN';
  end if;

  update public.group_members as member_row
  set role = p_role
  where member_row.id = target_member.id
  returning member_row.* into target_member;

  return target_member;
end;
$$;

create function private.deactivate_group_member(p_group_member_id uuid)
returns public.group_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
  target_member public.group_members%rowtype;
begin
  select member_row.group_id into target_group_id
  from public.group_members as member_row
  where member_row.id = p_group_member_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_group_id::text, 0));

  if not private.is_group_admin(target_group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  select member_row.* into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id
  for update;

  if target_member.deactivated_at is not null then
    return target_member;
  end if;

  if target_member.role = 'ADMIN'::public.group_member_role
    and not exists (
      select 1 from public.group_members as other_admin
      where other_admin.group_id = target_group_id
        and other_admin.id <> target_member.id
        and other_admin.role = 'ADMIN'::public.group_member_role
        and other_admin.deactivated_at is null
    ) then
    raise exception using errcode = 'P0001', message = 'GROUP_LAST_ADMIN';
  end if;

  update public.group_members as member_row
  set deactivated_at = pg_catalog.statement_timestamp()
  where member_row.id = target_member.id
  returning member_row.* into target_member;

  update public.group_invitations as invitation
  set revoked_at = pg_catalog.statement_timestamp()
  where invitation.group_member_id = target_member.id
    and invitation.accepted_at is null
    and invitation.revoked_at is null;

  return target_member;
end;
$$;

create function private.reactivate_group_member(p_group_member_id uuid)
returns public.group_members
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_member public.group_members%rowtype;
begin
  select member_row.* into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_member.group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  update public.group_members as member_row
  set deactivated_at = null
  where member_row.id = target_member.id
  returning member_row.* into target_member;

  return target_member;
end;
$$;

create function private.set_group_avatar(p_group_id uuid, p_avatar_path text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not private.is_group_admin(p_group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  if p_avatar_path is distinct from 'groups/' || p_group_id::text || '/avatar' then
    raise exception using errcode = '22023', message = 'GROUP_AVATAR_PATH_INVALID';
  end if;

  update public.groups as group_row
  set avatar_url = p_avatar_path
  where group_row.id = p_group_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'GROUP_NOT_FOUND';
  end if;

  return p_avatar_path;
end;
$$;

create function private.set_group_member_avatar(p_group_member_id uuid, p_avatar_path text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_member public.group_members%rowtype;
begin
  select member_row.* into target_member
  from public.group_members as member_row
  where member_row.id = p_group_member_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'MEMBER_NOT_FOUND';
  end if;

  if not private.is_group_admin(target_member.group_id) then
    raise exception using errcode = '42501', message = 'GROUP_ADMIN_REQUIRED';
  end if;

  if p_avatar_path is distinct from
    'members/' || target_member.group_id::text || '/' || target_member.id::text || '/avatar' then
    raise exception using errcode = '22023', message = 'MEMBER_AVATAR_PATH_INVALID';
  end if;

  update public.group_members as member_row
  set avatar_url = p_avatar_path
  where member_row.id = target_member.id;

  return p_avatar_path;
end;
$$;

create function private.group_asset_group_id(object_name text)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when object_name ~ '^groups/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar$'
      then pg_catalog.split_part(object_name, '/', 2)::uuid
    when object_name ~ '^members/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar$'
      then pg_catalog.split_part(object_name, '/', 2)::uuid
    else null
  end;
$$;

create function private.can_read_group_asset(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_group_member(private.group_asset_group_id(object_name));
$$;

create function private.can_manage_group_asset(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_group_admin(private.group_asset_group_id(object_name))
    and (
      object_name like 'groups/%'
      or exists (
        select 1
        from public.group_members as member_row
        where member_row.id::text = pg_catalog.split_part(object_name, '/', 3)
          and member_row.group_id = private.group_asset_group_id(object_name)
      )
    );
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-assets',
  'group-assets',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "group_assets_select_active_members"
on storage.objects for select
to authenticated
using (bucket_id = 'group-assets' and private.can_read_group_asset(name));

create policy "group_assets_insert_admins"
on storage.objects for insert
to authenticated
with check (bucket_id = 'group-assets' and private.can_manage_group_asset(name));

create policy "group_assets_update_admins"
on storage.objects for update
to authenticated
using (bucket_id = 'group-assets' and private.can_manage_group_asset(name))
with check (bucket_id = 'group-assets' and private.can_manage_group_asset(name));

create function public.create_group(p_name text, p_description text default null)
returns table (group_id uuid, group_name text, membership_id uuid)
language sql
volatile
security invoker
set search_path = ''
as $$ select * from private.create_group(p_name, p_description); $$;

create function public.update_group(p_group_id uuid, p_name text, p_description text default null)
returns public.groups
language sql volatile security invoker set search_path = ''
as $$ select private.update_group(p_group_id, p_name, p_description); $$;

create function public.add_group_member(
  p_group_id uuid,
  p_display_name text,
  p_nickname text default null,
  p_role public.group_member_role default 'MEMBER'::public.group_member_role
)
returns public.group_members
language sql volatile security invoker set search_path = ''
as $$ select private.add_group_member(p_group_id, p_display_name, p_nickname, p_role); $$;

create function public.update_group_member(
  p_group_member_id uuid,
  p_display_name text,
  p_nickname text default null
)
returns public.group_members
language sql volatile security invoker set search_path = ''
as $$ select private.update_group_member(p_group_member_id, p_display_name, p_nickname); $$;

create function public.change_group_member_role(
  p_group_member_id uuid,
  p_role public.group_member_role
)
returns public.group_members
language sql volatile security invoker set search_path = ''
as $$ select private.change_group_member_role(p_group_member_id, p_role); $$;

create function public.deactivate_group_member(p_group_member_id uuid)
returns public.group_members
language sql volatile security invoker set search_path = ''
as $$ select private.deactivate_group_member(p_group_member_id); $$;

create function public.reactivate_group_member(p_group_member_id uuid)
returns public.group_members
language sql volatile security invoker set search_path = ''
as $$ select private.reactivate_group_member(p_group_member_id); $$;

create function public.set_group_avatar(p_group_id uuid, p_avatar_path text)
returns text
language sql volatile security invoker set search_path = ''
as $$ select private.set_group_avatar(p_group_id, p_avatar_path); $$;

create function public.set_group_member_avatar(p_group_member_id uuid, p_avatar_path text)
returns text
language sql volatile security invoker set search_path = ''
as $$ select private.set_group_member_avatar(p_group_member_id, p_avatar_path); $$;

revoke all on function private.create_group(text, text) from public, anon, authenticated;
revoke all on function private.update_group(uuid, text, text) from public, anon, authenticated;
revoke all on function private.add_group_member(uuid, text, text, public.group_member_role) from public, anon, authenticated;
revoke all on function private.update_group_member(uuid, text, text) from public, anon, authenticated;
revoke all on function private.change_group_member_role(uuid, public.group_member_role) from public, anon, authenticated;
revoke all on function private.deactivate_group_member(uuid) from public, anon, authenticated;
revoke all on function private.reactivate_group_member(uuid) from public, anon, authenticated;
revoke all on function private.set_group_avatar(uuid, text) from public, anon, authenticated;
revoke all on function private.set_group_member_avatar(uuid, text) from public, anon, authenticated;
revoke all on function private.group_asset_group_id(text) from public, anon, authenticated;
revoke all on function private.can_read_group_asset(text) from public, anon, authenticated;
revoke all on function private.can_manage_group_asset(text) from public, anon, authenticated;

grant execute on function private.create_group(text, text) to authenticated;
grant execute on function private.update_group(uuid, text, text) to authenticated;
grant execute on function private.add_group_member(uuid, text, text, public.group_member_role) to authenticated;
grant execute on function private.update_group_member(uuid, text, text) to authenticated;
grant execute on function private.change_group_member_role(uuid, public.group_member_role) to authenticated;
grant execute on function private.deactivate_group_member(uuid) to authenticated;
grant execute on function private.reactivate_group_member(uuid) to authenticated;
grant execute on function private.set_group_avatar(uuid, text) to authenticated;
grant execute on function private.set_group_member_avatar(uuid, text) to authenticated;
grant execute on function private.group_asset_group_id(text) to authenticated;
grant execute on function private.can_read_group_asset(text) to authenticated;
grant execute on function private.can_manage_group_asset(text) to authenticated;

revoke all on function public.create_group(text, text) from public, anon, authenticated;
revoke all on function public.update_group(uuid, text, text) from public, anon, authenticated;
revoke all on function public.add_group_member(uuid, text, text, public.group_member_role) from public, anon, authenticated;
revoke all on function public.update_group_member(uuid, text, text) from public, anon, authenticated;
revoke all on function public.change_group_member_role(uuid, public.group_member_role) from public, anon, authenticated;
revoke all on function public.deactivate_group_member(uuid) from public, anon, authenticated;
revoke all on function public.reactivate_group_member(uuid) from public, anon, authenticated;
revoke all on function public.set_group_avatar(uuid, text) from public, anon, authenticated;
revoke all on function public.set_group_member_avatar(uuid, text) from public, anon, authenticated;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.update_group(uuid, text, text) to authenticated;
grant execute on function public.add_group_member(uuid, text, text, public.group_member_role) to authenticated;
grant execute on function public.update_group_member(uuid, text, text) to authenticated;
grant execute on function public.change_group_member_role(uuid, public.group_member_role) to authenticated;
grant execute on function public.deactivate_group_member(uuid) to authenticated;
grant execute on function public.reactivate_group_member(uuid) to authenticated;
grant execute on function public.set_group_avatar(uuid, text) to authenticated;
grant execute on function public.set_group_member_avatar(uuid, text) to authenticated;
