# Event History

PR25 exposes completed Wednesdays as a read-only projection of the canonical Event model. It does not copy Events, freeze payment totals, regenerate teams or recalculate settlement allocations.

## Eligibility, ordering and pagination

`get_group_event_history` returns only `CLOSED` Events for one Group after validating that `auth.uid()` has an active membership. Events with pending payments remain eligible because closure and collection completion are independent. Ordering is stable by canonical `starts_at DESC, id DESC`.

The first page contains ten Events. Subsequent pages use a `(starts_at, event_id)` keyset cursor, avoiding the duplicate/skipped-row behavior of offset pagination while new Events are added. The focused list RPC obtains actual football and Dinner counts through independent correlated aggregates, so joining both activities cannot multiply rows. Guests count exactly like linked members when their actual attendance is `YES`; planned confirmations never affect the totals.

The partial index `events_closed_group_starts_at_id_idx` supports Group filtering, closed-state filtering and cursor ordering without duplicating the existing active-Event index.

## Routes and detail

- `/groups/:groupId/history` lists the selected Group's completed Events.
- `/groups/:groupId/history/:eventId` is a refresh-safe and shareable detail route.

The detail verifies that the Event belongs to the Group from the URL and remains `CLOSED`. It then lazily composes existing protected read models for actual attendance, persisted team lineup and event-scoped DTs, Dinner planning, actual Dinner attendance and expenses, finalized Match/Dinner settlements, current payments and the PR24 final summary.

Opening the detail URL directly also reloads the Group and restores `GroupContext` before exposing downstream navigation. This keeps refreshes, shared links and the canonical Payments route scoped to the same Group without requiring a prior visit to the History list.

Historical members remain visible when later deactivated because the attendance read model includes any member with an EventParticipant row. Guests need no Profile or account. Names for attendance and teams currently resolve from the persisted Guest name or current GroupMember display name; settlement items retain their own finalized display-name snapshot. PR25 deliberately does not add a general identity-versioning system.

## Financial and operational integrity

Team assignments and DTs come from the selected Event and are never regenerated. Dinner planned purchases remain visibly separate from actual expenses. Settlement totals and individual obligations come from immutable PR21/PR22 snapshots. Payment summaries come from the current PR23 markers, so an ADMIN payment recorded after closure is immediately reflected while the Event remains `CLOSED`.

All monetary values stay in integer minor units. Match and Dinner remain independent, and the combined outstanding value comes from the exact PR24 summary.

Operational history is read-only. The only mutation path offered is navigation to the canonical Payments screen, where the existing ADMIN authorization applies.

## Security and future statistics

The list RPC derives identity from `auth.uid()`, uses an empty search path, schema-qualified relations and explicit EXECUTE grants. Detail RPCs independently validate active Event access. Unauthenticated, inactive and unrelated users are rejected without revealing cross-Group Event details.

The compact list projection and focused detail facade establish reusable data-access boundaries for future statistics, but PR25 creates no charts, rankings or aggregate analytics tables.
