do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'events',
    'event_participants',
    'teams',
    'event_managers',
    'dinner_plans',
    'dinner_expenses',
    'match_settlements',
    'match_settlement_items',
    'dinner_settlements',
    'dinner_settlement_items',
    'payments'
  ] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
