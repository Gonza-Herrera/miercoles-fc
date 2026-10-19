# Realtime & Multi-device

PR26 uses Supabase Postgres Changes as an invalidation transport. PostgreSQL and the existing RPC read models remain authoritative: a change notification is coalesced and causes the affected screen to refetch its protected Event snapshot. Realtime payloads are never merged into financial, attendance, team or draft state.

## Scope and lifecycle

`RealtimeService` reuses `SUPABASE_CLIENT` and shares one channel per Event, even when several nested components are interested in it. It watches the Event-owned tables needed by attendance, teams, draft, Dinner, settlements and payments. A separate Group channel watches Event creation/status for the selected Group.

Every consumer registers cleanup through Angular `DestroyRef`. The final listener removes the channel; logout removes all channels and clears subscriptions. Session refresh sends the new access token to Realtime. `SUBSCRIBED` and foreground restoration invalidate current state, covering changes missed while reconnecting or while the PWA was suspended. Notifications arriving within 75 ms are coalesced.

Connection state is exposed as `CONNECTING`, `CONNECTED`, `RECONNECTING` or `DISCONNECTED`. The shell displays subtle status text. No mutation is queued offline, especially draft picks, attendance or payments.

## Authorization and publication

The additive PR26 migration publishes only these RLS-protected tables: `events`, `event_participants`, `teams`, `team_members`, `event_managers`, `event_drafts`, `dinner_plans`, `dinner_expenses`, Match/Dinner settlement headers and items, and `payments`.

Postgres Changes evaluates the subscribing user's existing `SELECT` policies. An Event ID or channel name is not authorization. Browser writes remain revoked and all mutations continue through the existing role- and lifecycle-aware RPCs. No service-role key, Broadcast policy or public payment channel is introduced.

## Draft concurrency

PR17 already provides the required server-side guarantees. `select_draft_player` locks the single `event_drafts` row, validates `expected_version`, current DT, participant eligibility and team capacity, inserts the assignment under the unique `(event_id, event_participant_id)` constraint, advances the turn and increments the version in the same transaction. Competing requests serialize; at most one succeeds. A stale/conflicting client refetches the complete draft snapshot and shows Spanish recovery copy.

Realtime improves visibility but is not part of this correctness protocol. The client does not optimistically remove a player and does not replay a failed pick.

## Domain invalidation

- Attendance and guests refetch participant read models.
- Dashboard refetches Event, planned attendance and Dinner menu.
- Lineup and draft refetch persisted teams, DTs, availability, capacity and turn.
- Dinner refetches planning, actual attendance, expenses and totals.
- Payments refetches independent Match/Dinner settlements and payment summaries.
- Closure and History detail refetch their full authoritative summaries, including post-closure payments.

## Deployment

Realtime must be enabled for the Supabase project and the migration must be applied. No new browser secret or environment variable is required. Production networks must allow the `wss://<project-ref>.supabase.co/realtime/v1/websocket` connection.

## Manual multi-device verification

Use three independent authenticated sessions: ADMIN, MEMBER and a linked DT.

1. MEMBER confirms football attendance; verify ADMIN changes from 9 to 10 without refresh.
2. DT Gazpar drafts Nico; verify Nico disappears for Diego, Team A gains Nico and the turn advances.
3. Race two picks for the same player; verify one succeeds, one reloads, and no team/turn corruption occurs.
4. ADMIN marks only Diego's Match obligation paid; verify the other devices update Match while Dinner remains unchanged.
5. Close the Event; verify every session becomes read-only while ADMIN can still manage canonical payments.
6. Disconnect one device, mutate another, reconnect/foreground the first and verify an authoritative resync.
7. Switch from Group A to Group B and verify the old Group/Event channels are removed.
