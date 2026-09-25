create function public.list_invitable_group_members()
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
    and exists (
      select 1
      from public.group_members as administrator
      where administrator.group_id = target.group_id
        and administrator.profile_id = (select auth.uid())
        and administrator.role = 'ADMIN'::public.group_member_role
    )
  order by group_row.name, target.display_name, target.id;
$$;

create function public.create_group_invitation(p_group_member_id uuid)
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

  if not exists (
    select 1
    from public.group_members as administrator
    where administrator.group_id = target_member.group_id
      and administrator.profile_id = caller_profile_id
      and administrator.role = 'ADMIN'::public.group_member_role
  ) then
    raise exception using errcode = '42501', message = 'INVITATION_ADMIN_REQUIRED';
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

create function public.get_group_invitation_preview(p_raw_token text)
returns table (
  status text,
  group_name text,
  member_display_name text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invitation_hash bytea;
begin
  if p_raw_token is null or p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'INVALID'::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  invitation_hash := extensions.digest(pg_catalog.convert_to(p_raw_token, 'UTF8'), 'sha256');

  return query
  select
    case
      when invitation.revoked_at is not null then 'REVOKED'
      when invitation.accepted_at is not null then 'ACCEPTED'
      when invitation.expires_at is not null
        and invitation.expires_at <= pg_catalog.statement_timestamp() then 'EXPIRED'
      when member_row.profile_id is not null then 'MEMBER_LINKED'
      else 'ACTIVE'
    end::text,
    group_row.name,
    member_row.display_name,
    invitation.expires_at
  from public.group_invitations as invitation
  join public.groups as group_row on group_row.id = invitation.group_id
  join public.group_members as member_row on member_row.id = invitation.group_member_id
  where invitation.token_hash = invitation_hash;

  if not found then
    return query select 'INVALID'::text, null::text, null::text, null::timestamptz;
  end if;
end;
$$;

create function public.accept_group_invitation(p_raw_token text)
returns table (
  status text,
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
  invitation_hash bytea;
  invitation_row public.group_invitations%rowtype;
  target_member public.group_members%rowtype;
  target_group_name text;
  target_member_id uuid;
begin
  if caller_profile_id is null then
    raise exception using errcode = 'P0001', message = 'INVITATION_AUTH_REQUIRED';
  end if;

  if p_raw_token is null or p_raw_token !~ '^[A-Za-z0-9_-]{43}$' then
    return query select 'INVALID'::text, null::uuid, null::text, null::uuid, null::text;
    return;
  end if;

  if not exists (
    select 1 from public.profiles as profile where profile.id = caller_profile_id
  ) then
    raise exception using errcode = 'P0001', message = 'INVITATION_PROFILE_REQUIRED';
  end if;

  invitation_hash := extensions.digest(pg_catalog.convert_to(p_raw_token, 'UTF8'), 'sha256');

  select invitation.group_member_id
  into target_member_id
  from public.group_invitations as invitation
  where invitation.token_hash = invitation_hash;

  if not found then
    return query select 'INVALID'::text, null::uuid, null::text, null::uuid, null::text;
    return;
  end if;

  select member_row.*
  into target_member
  from public.group_members as member_row
  where member_row.id = target_member_id
  for update;

  select invitation.*
  into invitation_row
  from public.group_invitations as invitation
  where invitation.token_hash = invitation_hash
  for update;

  select group_row.name
  into target_group_name
  from public.groups as group_row
  where group_row.id = invitation_row.group_id;

  if invitation_row.revoked_at is not null then
    return query
    select 'REVOKED'::text, invitation_row.group_id, target_group_name,
      target_member.id, target_member.display_name;
    return;
  end if;

  if invitation_row.accepted_at is not null then
    if target_member.profile_id = caller_profile_id then
      return query
      select 'ALREADY_MEMBER'::text, invitation_row.group_id, target_group_name,
        target_member.id, target_member.display_name;
    else
      return query
      select 'ACCEPTED'::text, invitation_row.group_id, target_group_name,
        target_member.id, target_member.display_name;
    end if;
    return;
  end if;

  if invitation_row.expires_at is not null
    and invitation_row.expires_at <= pg_catalog.statement_timestamp() then
    return query
    select 'EXPIRED'::text, invitation_row.group_id, target_group_name,
      target_member.id, target_member.display_name;
    return;
  end if;

  if target_member.profile_id is not null then
    if target_member.profile_id = caller_profile_id then
      return query
      select 'ALREADY_MEMBER'::text, invitation_row.group_id, target_group_name,
        target_member.id, target_member.display_name;
    else
      return query
      select 'MEMBER_LINKED'::text, invitation_row.group_id, target_group_name,
        target_member.id, target_member.display_name;
    end if;
    return;
  end if;

  if exists (
    select 1
    from public.group_members as existing_membership
    where existing_membership.group_id = target_member.group_id
      and existing_membership.profile_id = caller_profile_id
      and existing_membership.id <> target_member.id
  ) then
    return query
    select 'PROFILE_ALREADY_MEMBER'::text, invitation_row.group_id, target_group_name,
      target_member.id, target_member.display_name;
    return;
  end if;

  update public.group_members as member_row
  set profile_id = caller_profile_id
  where member_row.id = target_member.id;

  update public.group_invitations as invitation
  set accepted_at = pg_catalog.statement_timestamp()
  where invitation.id = invitation_row.id;

  return query
  select 'ACCEPTED_NOW'::text, invitation_row.group_id, target_group_name,
    target_member.id, target_member.display_name;
end;
$$;

create function public.revoke_group_invitation(p_group_member_id uuid)
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

  if not exists (
    select 1
    from public.group_members as administrator
    where administrator.group_id = target_member.group_id
      and administrator.profile_id = caller_profile_id
      and administrator.role = 'ADMIN'::public.group_member_role
  ) then
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

revoke all on function public.list_invitable_group_members() from public, anon, authenticated;
revoke all on function public.create_group_invitation(uuid) from public, anon, authenticated;
revoke all on function public.get_group_invitation_preview(text) from public, anon, authenticated;
revoke all on function public.accept_group_invitation(text) from public, anon, authenticated;
revoke all on function public.revoke_group_invitation(uuid) from public, anon, authenticated;

grant execute on function public.list_invitable_group_members() to authenticated;
grant execute on function public.create_group_invitation(uuid) to authenticated;
grant execute on function public.get_group_invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_group_invitation(text) to authenticated;
grant execute on function public.revoke_group_invitation(uuid) to authenticated;
