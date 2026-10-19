# Event Closure & Summary

PR24 closes a Wednesday without conflating event completion with collection completion. The lifecycle remains `DRAFT → OPEN → IN_PROGRESS → SETTLEMENT → CLOSED`; only `close_event` may perform the last transition.

## Closure readiness

An active group ADMIN can close only from `SETTLEMENT`. Match and Dinner attendance must both have been explicitly recorded, including an explicit zero. Football with actual players requires its finalized Match Settlement. Dinner with actual diners and positive expenses requires its finalized Dinner Settlement. A positive court cost with zero players, or positive Dinner expenses with zero diners, is an invalid unresolved state. Zero players with a zero court cost and zero diners with zero expenses are valid no-activity outcomes.

Pending payments never block closure. `close_event` locks the Event row, rechecks authorization and readiness in PostgreSQL, changes the status, and derives `closed_at` from `clock_timestamp()` and `closed_by` from `auth.uid()` in one transaction. A repeated call on the same closed Event returns the summary without changing closure metadata, so concurrent calls are safe and idempotent. Existing historical closed rows are backfilled from their prior `updated_at` and `created_by` audit values.

## Historical immutability and payments

`CLOSED` keeps event details, attendance, teams, guests, Dinner expenses and both settlement snapshots immutable through the existing trigger/RPC guards and revoked direct browser writes. Payment markers are the deliberate exception: an ADMIN may still change an existing Match or Dinner obligation between `PENDING` and `PAID`. This never recalculates an obligation and never reopens the Event. MEMBERs have read-only access.

## Summary read model

`get_event_closure_summary` is a focused, membership-protected read model. Match count comes from actual football attendance and its money comes from the immutable Match Settlement items once finalized. Dinner count comes from actual Dinner attendance, expenses from the recorded expense rows, and financial obligations from immutable Dinner Settlement items. Guest items are ordinary settlement obligations and therefore participate in counts, collected amounts and outstanding amounts without needing an account.

All values remain integer minor units. For each activity, `collected + outstanding = settlement total`; consolidated values are calculated from exact Match and Dinner totals, never from formatted or separately rounded labels. `collectionComplete` is true only when the exact consolidated outstanding amount is zero. It can become true after closure while the Event remains `CLOSED`.

## Security and PR25 compatibility

Functions derive identity from `auth.uid()`, use an empty search path, schema-qualified relations, explicit EXECUTE grants, active membership checks and ADMIN checks for writes. RLS continues to protect table reads and unrelated users cannot access the summary. `closed_at`, `closed_by` and the stable summary RPC provide the historical anchor PR25 can list later; PR24 does not implement history browsing or filters.
