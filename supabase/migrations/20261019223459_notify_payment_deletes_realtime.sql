create function private.touch_payment_event_for_realtime()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.events
  set updated_at = clock_timestamp()
  where id = coalesce(new.event_id, old.event_id);
  return coalesce(new, old);
end;
$$;

create trigger payments_touch_event_for_realtime
after insert or delete on public.payments
for each row execute function private.touch_payment_event_for_realtime();

revoke all on function private.touch_payment_event_for_realtime()
from public, anon, authenticated;
