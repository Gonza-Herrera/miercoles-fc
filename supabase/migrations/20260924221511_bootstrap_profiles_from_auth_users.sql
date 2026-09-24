create function private.profile_display_name(user_email text, user_metadata jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      pg_catalog.left(
        pg_catalog.btrim(
          case
            when pg_catalog.jsonb_typeof(user_metadata -> 'full_name') = 'string'
              then user_metadata ->> 'full_name'
          end
        ),
        80
      ),
      ''
    ),
    nullif(
      pg_catalog.left(
        pg_catalog.btrim(
          case
            when pg_catalog.jsonb_typeof(user_metadata -> 'name') = 'string'
              then user_metadata ->> 'name'
          end
        ),
        80
      ),
      ''
    ),
    nullif(pg_catalog.left(pg_catalog.split_part(coalesce(user_email, ''), '@', 1), 80), ''),
    'Jugador'
  );
$$;

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    private.profile_display_name(new.email, new.raw_user_meta_data)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.profile_display_name(text, jsonb) from public;
revoke all on function private.handle_new_auth_user() from public;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  auth_user.id,
  private.profile_display_name(auth_user.email, auth_user.raw_user_meta_data)
from auth.users as auth_user
on conflict (id) do nothing;
