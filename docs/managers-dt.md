# Managers / DT

## Purpose

PR16 gives each event an explicit team-building mode:

- `RANDOM` uses the PR15 random team generator and persisted roster.
- `MANAGERS` creates the team structure and PR17 fills its rosters through a
  player draft.

The mode belongs to an event. It is not a group or profile preference, so two
Wednesdays in the same group may use different modes.

## Temporary responsibility, not a role

Persistent `group_members.role` values remain exactly `ADMIN | MEMBER`. A DT is
an assignment in `event_managers` linking one Event, one Team, and one
GroupMember. Assigning Gazpar as DT does not change Gazpar's persistent role
and does not grant event-administration privileges.

An ADMIN may also be a DT. A DT may have played (`actual_football = YES`) or
may be a non-player because manager eligibility is deliberately independent
from attendance.

## Eligibility and identity

A DT must be a GroupMember who:

- belongs to the event's group;
- is active (`deactivated_at is null`);
- has a linked Profile/account.

The linked-account rule is intentional: PR17 requires each DT to operate the
draft from an authenticated session. Unlinked active members are visible in
the UI as requiring invitation/account linking, but cannot be selected. Guests
cannot be DTs because they do not have a persistent GroupMember identity.

Both `ADMIN` and `MEMBER` satisfy eligibility. Deactivating or unlinking a
member removes their assignment from mutable (`OPEN` or `IN_PROGRESS`) events,
making the configuration visibly incomplete rather than leaving an ineligible
active DT.

## Dynamic team and manager count

Angular applies the PR14 Team Formation Engine to the PR13 actual-player list.
Its `teamCount` is passed to the focused mode operation:

- two teams require exactly two DTs;
- three teams require exactly three DTs.

PR16 does not copy the player-count formulas. PostgreSQL validates that a
complete manager save covers every persisted team exactly once. The UI derives
`required`, `assigned`, `missing`, and `complete` rather than persisting those
values.

When attendance changes from a two-team to a three-team plan, the next ADMIN
load adds Team C with no DT. When it changes back, the operation removes Team C
and its temporary manager assignment. Existing A/B team UUIDs and assignments
remain stable.

## Mode switching

Mode changes are transactional and allowed only for active ADMINs in `OPEN` or
`IN_PROGRESS`:

- `RANDOM → MANAGERS` removes the incompatible random roster and rebuilds empty
  A/B(/C) teams for managers and the future draft.
- `MANAGERS → RANDOM` removes temporary manager assignments and empty draft
  teams. The ADMIN can then run PR15 again.

Actual attendance and the PR14 plan are never modified. PR17 now snapshots that
plan on start and locks attendance, mode, teams, and DT assignments for the rest
of the draft lifecycle. See [Player Draft](player-draft.md).

## Atomic manager configuration

`configure_event_team_managers(event_id, assignments)` replaces the full set
inside one PostgreSQL transaction. It locks the event and the selected member
rows, then verifies authentication, active ADMIN membership, event lifecycle,
mode, team/event ownership, member/group ownership, activity, linked account,
unique teams, unique managers, and exact assignment count.

The pre-existing constraints remain authoritative under concurrency:

- `UNIQUE(team_id)` permits at most one manager per team;
- `UNIQUE(event_id, group_member_id)` prevents one person from managing two
  teams in the same event;
- the composite `(team_id, event_id)` foreign key prevents cross-event teams;
- the existing group guard plus PR16 eligibility trigger prevents cross-group
  and ineligible managers.

The same GroupMember may manage teams in different events.

## Read access and authorization

Active group members can read the event mode and DT assignments through the
existing RLS-protected tables and focused read RPC. Only an active ADMIN can
call the mutation operations successfully. Being present in `event_managers`
does not satisfy any ADMIN check.

The private implementations use `SECURITY DEFINER`, derive the caller from
`auth.uid()`, set an empty `search_path`, schema-qualify objects, and validate
authorization server-side. Public wrappers and direct table grants do not
permit browser writes. No service-role key is exposed.

## UI

The Match team screen uses an accessible radio-style mode selector for ADMINs
and a textual read-only mode for members. MANAGERS mode renders one labeled
native select per team, disables already-selected people in other teams,
announces missing DTs in text, and prevents saving until all slots are filled.
Selectors use active linked members only and work without relying on color.

The operation requires backend confirmation. There is no offline mutation
queue and the UI never claims success before Supabase accepts the transaction.
