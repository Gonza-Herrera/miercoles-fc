create or replace function private.create_group(p_name text, p_description text default null)
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
  normalized_description text := nullif(pg_catalog.btrim(p_description), '');
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

create or replace function private.update_group(
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
  normalized_description text := nullif(pg_catalog.btrim(p_description), '');
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

create or replace function private.add_group_member(
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
  normalized_nickname text := nullif(pg_catalog.btrim(p_nickname), '');
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

create or replace function private.update_group_member(
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
  normalized_nickname text := nullif(pg_catalog.btrim(p_nickname), '');
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
