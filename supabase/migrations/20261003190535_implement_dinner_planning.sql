create table public.dinner_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete restrict,
  menu text,
  purchase_owner_group_member_id uuid references public.group_members (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dinner_plans_menu_valid check (
    menu is null or (char_length(btrim(menu)) between 1 and 500)
  ),
  constraint dinner_plans_timestamp_order check (updated_at >= created_at)
);

create index dinner_plans_purchase_owner_idx
on public.dinner_plans (purchase_owner_group_member_id)
where purchase_owner_group_member_id is not null;

create table public.dinner_planned_purchases (
  id uuid primary key default gen_random_uuid(),
  dinner_plan_id uuid not null references public.dinner_plans (id) on delete cascade,
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint dinner_planned_purchases_name_valid check (
    char_length(btrim(name)) between 1 and 120
  ),
  constraint dinner_planned_purchases_sort_order_valid check (sort_order >= 0),
  constraint dinner_planned_purchases_order_unique unique (dinner_plan_id, sort_order)
    deferrable initially immediate
);

create trigger dinner_plans_set_updated_at
before update on public.dinner_plans
for each row execute function private.set_updated_at();

alter table public.dinner_plans enable row level security;
alter table public.dinner_planned_purchases enable row level security;

create policy "dinner_plans_select_group_members"
on public.dinner_plans for select
to authenticated
using (private.can_access_event(event_id));

create policy "dinner_planned_purchases_select_group_members"
on public.dinner_planned_purchases for select
to authenticated
using (
  exists (
    select 1
    from public.dinner_plans as plan
    where plan.id = dinner_plan_id
      and private.can_access_event(plan.event_id)
  )
);

revoke all on table public.dinner_plans from anon, authenticated;
revoke all on table public.dinner_planned_purchases from anon, authenticated;
grant select on table public.dinner_plans to authenticated;
grant select on table public.dinner_planned_purchases to authenticated;
grant all on table public.dinner_plans to service_role;
grant all on table public.dinner_planned_purchases to service_role;

create function private.get_dinner_planning(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_plan public.dinner_plans%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DINNER_PLAN_AUTH_REQUIRED';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_PLAN_EVENT_NOT_FOUND';
  end if;
  if not private.can_access_event(target_event.id) then
    raise exception using errcode = '42501', message = 'DINNER_PLAN_ACCESS_DENIED';
  end if;

  select plan.* into target_plan
  from public.dinner_plans as plan
  where plan.event_id = target_event.id;

  return jsonb_build_object(
    'eventId', target_event.id,
    'eventStatus', target_event.status,
    'confirmedDinerCount', (
      select count(*)
      from public.event_participants as participant
      where participant.event_id = target_event.id
        and participant.dinner_response = 'YES'::public.attendance_response
        and (participant.cancelled_at is null)
    ),
    'canEdit', private.is_group_admin(target_event.group_id)
      and target_event.status in (
        'DRAFT'::public.event_status,
        'OPEN'::public.event_status,
        'IN_PROGRESS'::public.event_status
      ),
    'plan', case when target_plan.id is null then null else jsonb_build_object(
      'id', target_plan.id,
      'eventId', target_plan.event_id,
      'menu', target_plan.menu,
      'updatedAt', target_plan.updated_at,
      'purchaseOwner', (
        select jsonb_build_object(
          'groupMemberId', owner.id,
          'displayName', owner.display_name,
          'nickname', owner.nickname,
          'avatarPath', owner.avatar_url,
          'active', owner.deactivated_at is null
        )
        from public.group_members as owner
        where owner.id = target_plan.purchase_owner_group_member_id
      ),
      'plannedPurchases', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', item.id,
          'name', item.name,
          'sortOrder', item.sort_order
        ) order by item.sort_order, item.id)
        from public.dinner_planned_purchases as item
        where item.dinner_plan_id = target_plan.id
      ), '[]'::jsonb)
    )
    end
  );
end;
$$;

create function public.get_dinner_planning(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$ select private.get_dinner_planning(p_event_id); $$;

create function private.save_dinner_plan(
  p_event_id uuid,
  p_menu text,
  p_purchase_owner_group_member_id uuid,
  p_planned_purchases jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target_event public.events%rowtype;
  target_plan public.dinner_plans%rowtype;
  normalized_menu text := nullif(pg_catalog.btrim(p_menu), '');
  item jsonb;
  item_id uuid;
  item_name text;
  item_order integer;
  retained_ids uuid[] := '{}';
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'DINNER_PLAN_AUTH_REQUIRED';
  end if;
  if p_planned_purchases is null or jsonb_typeof(p_planned_purchases) <> 'array' then
    raise exception using errcode = '22023', message = 'DINNER_PLAN_PURCHASES_INVALID';
  end if;
  if jsonb_array_length(p_planned_purchases) > 30 then
    raise exception using errcode = '22023', message = 'DINNER_PLAN_PURCHASES_LIMIT';
  end if;
  if normalized_menu is not null and char_length(normalized_menu) > 500 then
    raise exception using errcode = '22023', message = 'DINNER_PLAN_MENU_INVALID';
  end if;

  select event_row.* into target_event
  from public.events as event_row
  where event_row.id = p_event_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'DINNER_PLAN_EVENT_NOT_FOUND';
  end if;
  if not private.is_group_admin(target_event.group_id) then
    raise exception using errcode = '42501', message = 'DINNER_PLAN_ADMIN_REQUIRED';
  end if;
  if target_event.status not in (
    'DRAFT'::public.event_status,
    'OPEN'::public.event_status,
    'IN_PROGRESS'::public.event_status
  ) then
    raise exception using errcode = 'P0001', message = 'DINNER_PLAN_READ_ONLY';
  end if;

  if p_purchase_owner_group_member_id is not null and not exists (
    select 1
    from public.group_members as owner
    where owner.id = p_purchase_owner_group_member_id
      and owner.group_id = target_event.group_id
      and owner.deactivated_at is null
  ) then
    raise exception using errcode = '22023', message = 'DINNER_PLAN_OWNER_INVALID';
  end if;

  select plan.* into target_plan
  from public.dinner_plans as plan
  where plan.event_id = target_event.id
  for update;

  if found and p_expected_updated_at is not null
    and target_plan.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'DINNER_PLAN_CONFLICT';
  end if;

  if target_plan.id is null then
    insert into public.dinner_plans (event_id, menu, purchase_owner_group_member_id)
    values (target_event.id, normalized_menu, p_purchase_owner_group_member_id)
    returning * into target_plan;
  else
    update public.dinner_plans
    set menu = normalized_menu,
        purchase_owner_group_member_id = p_purchase_owner_group_member_id
    where id = target_plan.id
    returning * into target_plan;
  end if;

  set constraints public.dinner_planned_purchases_order_unique deferred;

  for item in select value from jsonb_array_elements(p_planned_purchases)
  loop
    item_id := nullif(item->>'id', '')::uuid;
    item_name := pg_catalog.btrim(item->>'name');
    item_order := (item->>'sortOrder')::integer;

    if item_name is null or char_length(item_name) not between 1 and 120
      or item_order is null or item_order < 0 then
      raise exception using errcode = '22023', message = 'DINNER_PLAN_PURCHASE_INVALID';
    end if;
    if item_id is not null and not exists (
      select 1 from public.dinner_planned_purchases as existing
      where existing.id = item_id and existing.dinner_plan_id = target_plan.id
    ) then
      raise exception using errcode = '22023', message = 'DINNER_PLAN_PURCHASE_INVALID';
    end if;

    if item_id is null then
      insert into public.dinner_planned_purchases (dinner_plan_id, name, sort_order)
      values (target_plan.id, item_name, item_order)
      returning id into item_id;
    else
      update public.dinner_planned_purchases
      set name = item_name, sort_order = item_order
      where id = item_id;
    end if;
    retained_ids := array_append(retained_ids, item_id);
  end loop;

  delete from public.dinner_planned_purchases
  where dinner_plan_id = target_plan.id
    and not (id = any(retained_ids));

  return private.get_dinner_planning(target_event.id);
exception
  when unique_violation then
    raise exception using errcode = '22023', message = 'DINNER_PLAN_PURCHASES_INVALID';
end;
$$;

create function public.save_dinner_plan(
  p_event_id uuid,
  p_menu text,
  p_purchase_owner_group_member_id uuid,
  p_planned_purchases jsonb,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language sql
volatile
set search_path = ''
as $$
  select private.save_dinner_plan(
    p_event_id,
    p_menu,
    p_purchase_owner_group_member_id,
    p_planned_purchases,
    p_expected_updated_at
  );
$$;

revoke all on function private.get_dinner_planning(uuid) from public, anon, authenticated;
revoke all on function public.get_dinner_planning(uuid) from public, anon, authenticated;
revoke all on function private.save_dinner_plan(uuid, text, uuid, jsonb, timestamptz)
from public, anon, authenticated;
revoke all on function public.save_dinner_plan(uuid, text, uuid, jsonb, timestamptz)
from public, anon, authenticated;

grant execute on function private.get_dinner_planning(uuid) to authenticated;
grant execute on function public.get_dinner_planning(uuid) to authenticated;
grant execute on function private.save_dinner_plan(uuid, text, uuid, jsonb, timestamptz)
to authenticated;
grant execute on function public.save_dinner_plan(uuid, text, uuid, jsonb, timestamptz)
to authenticated;
