alter function public.list_invitable_group_members() set schema private;
alter function public.create_group_invitation(uuid) set schema private;
alter function public.get_group_invitation_preview(text) set schema private;
alter function public.accept_group_invitation(text) set schema private;
alter function public.revoke_group_invitation(uuid) set schema private;

revoke all on function private.list_invitable_group_members() from public, anon, authenticated;
revoke all on function private.create_group_invitation(uuid) from public, anon, authenticated;
revoke all on function private.get_group_invitation_preview(text) from public, anon, authenticated;
revoke all on function private.accept_group_invitation(text) from public, anon, authenticated;
revoke all on function private.revoke_group_invitation(uuid) from public, anon, authenticated;

grant usage on schema private to anon;
grant execute on function private.get_group_invitation_preview(text) to anon, authenticated;
grant execute on function private.list_invitable_group_members() to authenticated;
grant execute on function private.create_group_invitation(uuid) to authenticated;
grant execute on function private.accept_group_invitation(text) to authenticated;
grant execute on function private.revoke_group_invitation(uuid) to authenticated;

create function public.list_invitable_group_members()
returns table (
  group_member_id uuid,
  member_display_name text,
  group_id uuid,
  group_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_invitable_group_members();
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
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.create_group_invitation(p_group_member_id);
$$;

create function public.get_group_invitation_preview(p_raw_token text)
returns table (
  status text,
  group_name text,
  member_display_name text,
  expires_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_group_invitation_preview(p_raw_token);
$$;

create function public.accept_group_invitation(p_raw_token text)
returns table (
  status text,
  group_id uuid,
  group_name text,
  group_member_id uuid,
  member_display_name text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select * from private.accept_group_invitation(p_raw_token);
$$;

create function public.revoke_group_invitation(p_group_member_id uuid)
returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.revoke_group_invitation(p_group_member_id);
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
