# Team Lineup UI

## Purpose and visual boundary

PR18 turns the persisted PR15/PR17 rosters into the primary football-first team
view. It borrows only the general spatial-lineup idea familiar from football games;
all geometry, colors, components and interaction are original Miércoles FC work.
No external pitch image, club asset, player card or game branding is used.

## Authoritative roster

The lineup reads `Team → TeamMember → EventParticipant`. It never runs the Team
Formation Engine, random generator, Manager configuration or Player Draft. A reload
therefore renders the same persisted roster instead of reshuffling it. Group members
and guests retain their event-scoped participant identity.

The focused read RPC returns event lifecycle/mode, edit capability, ordered Teams,
optional DT identity, and ordered players. Nickname is preferred visually, with the
full display name as fallback. Signed avatars use the existing private group-assets
flow; missing images use the existing Avatar initials.

## Pitch and layout engine

`FootballPitch` uses responsive HTML/CSS geometry with a vertical `aspect-ratio`.
The pure `calculateLineupSlots(count)` helper returns normalized percentage
coordinates. Sizes 1–6 use hand-balanced deterministic arrangements; larger rosters
use a deterministic three/four-column fallback. Roster order is `TeamMember.created_at`
then participant UUID, so the same roster retains the same visual placement.

These coordinates are presentation slots, not goalkeeper/defender/midfielder/forward
roles. PR18 adds no football-position domain and persists no x/y values. A future
role feature can change marker metadata without replacing the pitch component.

## Navigation and modes

Dynamic ARIA tabs support Team A/B/C and any later Team count. Tapping a tab or
swiping at least 48 px updates the same selected-Team signal. RANDOM mode omits the
DT header. MANAGERS mode shows the DT outside the pitch; a playing DT independently
appears again as a normal player marker.

The pitch has an equivalent semantic ordered roster for screen readers. Markers
provide complete labels including Team and guest status, focus remains visible,
controls meet the touch target, safe-area spacing is retained, and motion is removed
under `prefers-reduced-motion`.

## Editing and atomic swap

Only an active event-group ADMIN receives `canEdit`, and only while the Event is
`OPEN` or `IN_PROGRESS`. MEMBER and DT status alone remain read-only. Editing is
explicit: select a first player, switch Team, select a second player and confirm.
There is no drag-and-drop and no offline mutation queue.

`swap_event_team_players` derives the caller from `auth.uid()`, locks the Event and
both roster rows, verifies ADMIN/lifecycle/event ownership and requires different
Teams. A deferrable existing uniqueness constraint permits one atomic two-row Team
exchange while preserving both Team sizes and `TeamMember` history. Invalid or
cross-event inputs roll back without moving either player. `SETTLEMENT` and `CLOSED`
are read-only.

PR17's roster lock receives a transaction-local exception used only inside the
authorized swap RPC. Direct browser table writes remain revoked, so the exception
does not grant general roster mutation.

## States and future compatibility

The page provides loading, safe error/retry, no-Team and incomplete-draft states.
It is responsive at 360, 390 and 430 px and remains bounded on desktop. PR18 does
not subscribe to Realtime; successful swaps refetch the canonical read model. The
service boundary can be reloaded by a later synchronization feature without changing
the pitch or page state model.
