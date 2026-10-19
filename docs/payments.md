# Payments

PR23 answers whether each exact PR21/PR22 obligation was received. It never calculates how much somebody owes and never changes a settlement, attendance, expense or court price.

## Independent obligations

Match and Dinner are separate domains. The same EventParticipant can be `PAID` for `COURT` and `PENDING` for `DINNER`, or the reverse. There is no payment field on EventParticipant or GroupMember and no combined event-level status.

Each `payments` row references exactly one `match_settlement_item` or one `dinner_settlement_item`. Composite foreign keys include obligation, event and participant; an XOR check and category check reject invalid combinations. Partial unique indexes permit only one marker per obligation. Guests use the same EventParticipant reference and need no Profile account.

A database trigger also compares `payments.amount_minor` with the referenced settlement item on every insert or relevant update. This preserves the exact financial obligation even for privileged maintenance writes; the browser cannot provide or edit that amount.

## State and persistence

- No payment row means the full obligation is `PENDING`.
- One canonical row means the full obligation is `PAID`.
- `PENDING → PAID` inserts the marker with the exact persisted item amount.
- `PAID → PENDING` deletes the marker as an administrative correction.

Repeated requests already at the target state are no-ops. A repeated paid request preserves the original `paid_at`; a repeated pending request leaves no row. No partial amount, installment, refund, overpayment, method or gateway exists in v1.

PostgreSQL derives `paid_at` with its clock and `recorded_by` from `auth.uid()`. The browser cannot choose the event, participant, amount, recorder or timestamp. It supplies only obligation category/id, target state and the last observed `updated_at`.

## Authorization and lifecycle

Active linked group members can read the payment view. Only a group `ADMIN` may mutate payment status while the Event is `SETTLEMENT` or `CLOSED`. This PR24 refinement lets collection continue after the Wednesday finishes without reopening it or changing an obligation. `MEMBER`, event DT, purchase owner, participant, unrelated ADMIN and unauthenticated callers cannot mutate.

Direct browser writes to `payments` remain revoked. Public RPC wrappers run as `SECURITY INVOKER`; only their internal helpers use `SECURITY DEFINER`, with an empty search path, fully qualified relations, explicit caller/group checks and restricted execute grants. RLS remains enabled for table reads.

## Exact summaries

The read model partitions immutable item amounts:

```text
total = sum(all settlement item amounts)
collected = sum(items with a payment marker)
outstanding = sum(items without a payment marker)
collected + outstanding = total
```

All values are PostgreSQL `bigint` minor units. The calculation never multiplies a rounded average, so one-cent remainder allocations remain exact.

## Concurrency

The mutation locks the Event, obligation and current marker in a stable order. Database uniqueness prevents concurrent duplicate markers. Same-target retries are idempotent. A paid-to-pending correction must include the current row's `updated_at`; a mismatch raises `PAYMENTS_CONFLICT`, after which Angular reloads the authoritative view.

## UI and Event closure

`/payments` preserves settlement finalization when either source is not final. Once final, it shows separate Match and Dinner cards, pending rows before paid rows, exact collected/outstanding summaries, signed member avatars, guest/current-user context, an explicit “Todos pagaron” state and confirmation dialogs. ADMIN controls disappear for read-only members and closed events.

PR24 determines closure readiness from the two independent summaries without changing payment history. The closed Event summary continues linking to this payment view, with ADMIN correction controls and read-only MEMBER visibility. No payment gateway, transfer proof, reconciliation, reminder or Realtime subscription is introduced.
