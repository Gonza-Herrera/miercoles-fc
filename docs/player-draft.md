# Player Draft

## Purpose

PR17 fills `MANAGERS`-mode teams through a synchronized, turn-based draft. Every
active group member can watch the same event state; only the linked DT for the
current team can select a player. Persistent `ADMIN | MEMBER` roles are unchanged.
It consumes PR13 actual attendance, the PR14 capacity rules, and PR16 Teams/DTs;
it does not run PR15 random assignment.

## Lifecycle and capacity snapshot

`event_drafts` stores one row per event with `NOT_STARTED`, `IN_PROGRESS`, or
`COMPLETED` status, the current team, pick counter, optimistic `version`, timestamps,
and the exact PR14 capacity plan captured when the draft starts. PostgreSQL derives
the plan again from `actual_football = YES`, validates the team/DT configuration,
and locks the event row before starting.

Starting is ADMIN-only and requires an `IN_PROGRESS` event in `MANAGERS` mode,
complete eligible DT assignments, empty rosters, and at least two actual players.
If a DT also played, the start transaction assigns that participant to the DT's own
team before the first turn. Non-playing DTs consume no team place.

Actual guests are ordinary draftable participants because rosters reference
`EventParticipant`; they cannot be DTs or authenticate draft actions. Available
players are precisely non-cancelled `actual_football = YES` participants without a
`TeamMember`. Planned `football_response` is never used for eligibility.

## Turns and atomic picks

`select_draft_player(event, participant, expected_version)` locks the draft row and
validates all authoritative state in one transaction:

- the supplied version is current;
- the caller's linked GroupMember manages the current team;
- the participant belongs to the event, actually played, is active, and is unassigned;
- the current roster remains below its capacity.

The unique `(event_id, event_participant_id)` constraint is the final concurrent
selection guard. A successful pick advances round-robin to the next non-full team,
increments `version`, and completes automatically when no available players remain.
A stale phone receives a safe error and reloads the canonical snapshot.

A two-Team draft rotates `A → B → A → B`; a three-Team draft rotates
`A → B → C → A`. Teams at capacity are skipped without receiving a turn.

## Locks after start

From `IN_PROGRESS` onward, database triggers reject changes to actual football
attendance, formation mode, teams, DT assignments, and existing roster rows. This
keeps the capacity snapshot and turn history coherent. Direct browser table writes
remain revoked; mutations use the focused RPCs.

An active draft must finish before the Event can advance beyond `IN_PROGRESS`.
After completion, `SETTLEMENT` and `CLOSED` retain historical read access and reject
new picks.

## Read model and synchronization

`get_event_player_draft` returns one authorization-aware JSON snapshot containing
teams, DTs, capacities, rosters, available players, current turn, and caller
capabilities. It never depends on client-supplied role or manager identity.

The Angular route is `/events/:eventId/draft`. It subscribes to Postgres Changes for
`event_drafts` and `team_members`, then reloads the authoritative snapshot after any
change. The screen exposes connection state, disables picks while disconnected,
uses a confirmation dialog, and remains read-only for spectators. There is no
offline mutation queue.

RLS permits draft-row reads only to active linked members who can access the Event.
The RPCs derive the caller from `auth.uid()`; ADMIN authorizes start only and does
not authorize an out-of-turn pick. Realtime payloads are merely reload signals and
never grant capabilities.

## Manual verification

1. Configure two or three linked DTs in an `IN_PROGRESS` Managers event.
2. Open the draft as ADMIN and as both DTs on separate browsers/phones.
3. Start it and confirm playing DTs appear in their own rosters.
4. Confirm only the current DT can pick and every open client updates.
5. Attempt to pick the same player from two stale clients; only one write succeeds.
6. Fill a team and confirm turns skip it.
7. Make the final pick and confirm the status changes to `COMPLETED` everywhere.
8. Verify attendance, mode, teams, managers, and roster replacement are locked.

## Later boundaries

Post-draft player swaps/corrections, ratings, position balancing, settlement,
payments, chat, notifications, and offline writes remain outside PR17. The next PR
number is not documented in the current repository, so this implementation does
not invent a PR18 contract.
