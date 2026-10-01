# Team Formation Engine

## Purpose

The Team Formation Engine answers one domain question: given a number of actual
players, how many teams are required and what capacity should each team have?
It does not decide which player belongs to a team.

The implementation lives in
`src/app/features/match/domain/team-formation.ts`. It is plain TypeScript and
has no dependency on Angular, Supabase, RxJS, the DOM, browser APIs, time,
storage, network access, or randomness.

## Public contract

The caller provides only a non-negative integer:

```ts
calculateTeamFormation(playerCount: number): TeamFormationResult;
```

A successful result exposes the player count, team count, and ordered team
capacities:

```ts
{
  valid: true,
  playerCount: 14,
  teamCount: 3,
  teamSizes: [5, 5, 4]
}
```

Zero and one are valid football-domain inputs, but cannot form two teams. They
return an explicit result instead of throwing:

```ts
{
  valid: false,
  playerCount: 1,
  reason: 'INSUFFICIENT_PLAYERS'
}
```

Negative numbers, fractional numbers, `NaN`, and infinite values are technical
input errors. The engine throws `TeamFormationInputError`, whose stable code is
`INVALID_PLAYER_COUNT`.

## Current business rules

| Players | Formation            |
| ------: | :------------------- |
|     0–1 | Insufficient players |
|       2 | 1 vs 1               |
|       3 | 1 vs 2               |
|       4 | 2 vs 2               |
|       5 | 2 vs 3               |
|       6 | 3 vs 3               |
|       7 | 3 vs 4               |
|       8 | 4 vs 4               |
|       9 | 4 vs 5               |
|      10 | 5 vs 5               |
|      11 | 5 vs 6               |
|      12 | 6 vs 6               |
|      13 | 5 / 5 / 3            |
|      14 | 5 / 5 / 4            |
|      15 | 5 / 5 / 5            |
|      16 | 5 / 5 / 6            |
| N >= 13 | 5 / 5 / (N - 10)     |

For 2–9 players, two teams are made as even as possible. The first capacity is
`floor(N / 2)` and the second is `ceil(N / 2)`, so an odd extra player always
belongs to the second capacity.

Counts 10, 11, and 12 use the explicit formations `[5, 5]`, `[5, 6]`, and
`[6, 6]`. From 13 onward the rule is literally `[5, 5, N - 10]`.

### Large-count limitation

The 13+ rule is intentionally not a general balancing algorithm. For example,
20 players produce `[5, 5, 10]`, not `[7, 7, 6]` and not four teams. If regular
group sizes outgrow this rule, a later product decision should replace it
explicitly rather than silently changing this engine.

## Invariants

Every successful plan guarantees:

- `playerCount >= 2`;
- `sum(teamSizes) === playerCount`;
- `teamCount === teamSizes.length`;
- every team capacity is positive;
- 2–12 players produce two teams;
- 13+ players produce three teams;
- 2–9 players differ by at most one;
- 13+ players keep the first two capacities at five.

The returned arrays are readonly at compile time. Runtime freezing is not
needed because the calculation owns each newly-created result and does not
share or mutate external state.

## Boundaries with later features

The intended Match Attendance boundary is:

```ts
const actualPlayers = await getActualPlayers(eventId);
const formation = calculateTeamFormation(actualPlayers.length);
```

Filtering `actual_football_attendance` belongs to the attendance read model,
not this engine. The Match Attendance implementation described as PR13 is not
present in the current branch, so PR14 does not fabricate or duplicate that
missing boundary.

PR15 can consume `actualPlayers` together with a valid plan's `teamSizes` to
assign players randomly. Future Manager/DT and draft flows can use the same
ordered values as team capacities. Labels such as Team A/B/C remain a UI
concern.

Randomization is separate because capacity calculation must be deterministic
and does not require player identities. Persistence is separate because a plan
is a recommendation; a later application workflow must decide whether and how
to write `teams` and `team_members`.

## Testing strategy

The Vitest suite covers 0 and 1, every explicit formation from 2 through 18,
the intentional 20-player limitation, all invalid-input categories, and
determinism. A table-driven range from 2 through 50 checks the invariants and
the exact branch-specific rules without adding a property-testing dependency.
