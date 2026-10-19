create function private.assert_payment_matches_obligation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  obligation_amount_minor bigint;
begin
  if new.category = 'COURT'::public.payment_category then
    select item.amount_minor into obligation_amount_minor
    from public.match_settlement_items as item
    where item.id = new.match_settlement_item_id
      and item.event_id = new.event_id
      and item.event_participant_id = new.event_participant_id;
  elsif new.category = 'DINNER'::public.payment_category then
    select item.amount_minor into obligation_amount_minor
    from public.dinner_settlement_items as item
    where item.id = new.dinner_settlement_item_id
      and item.event_id = new.event_id
      and item.event_participant_id = new.event_participant_id;
  end if;

  if obligation_amount_minor is null or new.amount_minor <> obligation_amount_minor then
    raise exception using
      errcode = '23514',
      message = 'PAYMENTS_AMOUNT_MUST_MATCH_OBLIGATION';
  end if;

  return new;
end;
$$;

create trigger payments_assert_obligation_amount
before insert or update of
  event_id,
  event_participant_id,
  category,
  amount_minor,
  match_settlement_item_id,
  dinner_settlement_item_id
on public.payments
for each row execute function private.assert_payment_matches_obligation();

alter function public.get_event_payments(uuid) security invoker;
alter function public.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) security invoker;

revoke all on function private.assert_payment_matches_obligation()
from public, anon, authenticated;
revoke all on function private.get_event_payments(uuid)
from public, anon, authenticated;
revoke all on function private.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) from public, anon, authenticated;

grant execute on function private.get_event_payments(uuid) to authenticated;
grant execute on function private.set_obligation_payment_status(
  public.payment_category,
  uuid,
  public.payment_status,
  timestamptz
) to authenticated;
