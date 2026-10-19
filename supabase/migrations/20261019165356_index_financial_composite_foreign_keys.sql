create index match_settlement_items_settlement_event_idx
on public.match_settlement_items (match_settlement_id, event_id);

create index match_settlement_items_participant_event_idx
on public.match_settlement_items (event_participant_id, event_id);

create index dinner_settlement_items_settlement_event_idx
on public.dinner_settlement_items (dinner_settlement_id, event_id);

create index dinner_settlement_items_participant_event_idx
on public.dinner_settlement_items (event_participant_id, event_id);

create index payments_match_obligation_event_participant_idx
on public.payments (
  match_settlement_item_id,
  event_id,
  event_participant_id
)
where match_settlement_item_id is not null;

create index payments_dinner_obligation_event_participant_idx
on public.payments (
  dinner_settlement_item_id,
  event_id,
  event_participant_id
)
where dinner_settlement_item_id is not null;
