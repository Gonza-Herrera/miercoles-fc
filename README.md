# Miércoles FC

A mobile-first PWA for organizing weekly football matches, teams, dinner expenses and payments.

## Project overview

Miércoles FC will help groups of friends coordinate their weekly match and the meal that follows it. The product roadmap includes group and event management, attendance, team organization, shared expenses, and payment tracking.

This repository currently contains the application foundation, Design System, mobile application shell, installable PWA infrastructure, Supabase/PostgreSQL backend contract, passwordless identity, secure invitations, group/member administration, weekly event management, attendance, the current-event dashboard, team formation, random team generation, temporary event DT assignments, synchronized player draft, final Team Lineup UI, the complete Dinner reality milestone, and Match Settlement. Dinner settlement and payment tracking remain on the roadmap.

## Current status

**PR21 — Match Settlement**

PR21 creates exact, immutable court obligations from the Event price and PR13 actual players. It supports guests, deterministic remainder allocation, ADMIN-only idempotent finalization and member reads without creating or updating Payments. PR22 — Dinner Settlement is next.

## Tech stack

- Angular 22 with standalone components
- TypeScript in strict mode
- Angular Router with lazy-loaded feature routes
- Supabase Auth with passwordless email and Google OAuth
- Supabase JS and PostgreSQL migrations
- SCSS
- Vitest
- ESLint and Prettier
- Node.js 24

Angular PWA, Supabase infrastructure, passwordless identity, invitations, group/member administration, and weekly event management are configured.

## Architecture

Application code follows a feature-oriented structure:

```text
src/app/
├── core/          # Future application-wide singleton infrastructure
├── shared/
│   ├── layout/    # Shell, header, navigation, and page composition
│   └── ui/        # Reusable, domain-agnostic visual primitives
├── features/      # Independently evolvable, lazy-loaded features
├── app.config.ts
├── app.routes.ts
└── app.ts
```

Only directories with useful code are committed. `core/` will be introduced when an application-wide concern belongs there.

The root component remains a minimal router host. Primary feature routes render inside a lazy-loaded mobile shell, while each feature owns its page and routes. Feature-specific code should remain inside its feature rather than moving into `shared/`.

Local and feature state will follow a Signals-first approach using `signal()`, `computed()`, and `effect()` when they solve a real state need. PR01 intentionally introduces no artificial state or state-management library.

Design tokens and global foundations live in `src/styles/`. See [Design System documentation](docs/design-system.md) for principles, token semantics, component APIs, and accessibility guidance.

## Application routes

| Route                    | Purpose                                           |
| ------------------------ | ------------------------------------------------- |
| `/auth`                  | Passwordless sign-in                              |
| `/auth/callback`         | Magic Link and OAuth callback                     |
| `/invite/:token`         | Public invitation preview and explicit acceptance |
| `/`                      | Current-event dashboard for the selected group    |
| `/match`                 | Football attendance for the current event         |
| `/dinner`                | Dinner confirmation, planning and reality         |
| `/payments`              | Match Settlement preview and final obligations    |
| `/invitations`           | Minimal protected ADMIN invitation surface        |
| `/groups`                | Protected group selection and administration      |
| `/groups/new`            | Atomic group creation                             |
| `/groups/:id`            | Group detail, members, lifecycle and invitations  |
| `/groups/:id/events`     | Event list and history for one group              |
| `/groups/:id/events/new` | ADMIN event creation                              |
| `/events/:id`            | Stable event detail and lifecycle actions         |
| `/events/:id/edit`       | Lifecycle-aware ADMIN editing                     |
| `/events/:id/draft`      | Synchronized Managers-mode player draft           |
| `/events/:id/lineup`     | Final mobile football-pitch Team view             |
| `/design-system`         | Development showcase outside primary navigation   |

Unknown routes redirect safely to `/`. All feature pages remain lazy loaded.

## Getting started

Use the Node.js version declared in `.nvmrc`:

```bash
nvm use
npm install
npm start
```

The development server is available at `http://localhost:4200/` by default.

## Development commands

```bash
npm start             # Start the development server
npm run build         # Create a production build
npm run build:configured # Generate Supabase runtime config from env vars, then build
npm run serve:pwa     # Serve a production configuration with Service Worker support
npm run supabase:start # Start the local Supabase stack (requires Docker-compatible runtime)
npm run supabase:reset # Rebuild the local database from committed migrations
npm run supabase:lint  # Validate the local PostgreSQL schema
npm run supabase:types # Regenerate the shared TypeScript database contract
npm run lint          # Run Angular and TypeScript linting
npm run format        # Format supported project files
npm run format:check  # Check formatting without changing files
```

## Testing

Run the Vitest unit test suite once:

```bash
npm test
```

The test suite covers the application host, routing, the showcase, and reusable component behavior.

## Progressive Web App

Miércoles FC is installable from supported browsers as a standalone PWA. Production builds use Angular's official Service Worker to cache the static application shell. This foundation does not make future business data or workflows available offline.

For local verification, run `npm run build` followed by `npm run serve:pwa`, open `http://localhost:4200` in a private browser window, and inspect the Manifest, Service Worker, and Cache Storage panels. See [PWA documentation](docs/pwa.md) for the complete installability and offline-shell checklist.

## Supabase and database

The application exposes one typed Supabase client through Angular dependency injection. Runtime browser configuration accepts only the project URL and public publishable key; no database password, secret key, Google secret, or service-role key belongs in the application.

The committed SQL migrations define profiles, groups, members, invitations, events, participants and guests, teams, event managers, dinner expenses, and independent court/dinner payments. Every application table has RLS enabled, while browser writes remain closed until their feature PR defines precise authorization.

Copy `public/config/supabase-config.example.json` to the Git-ignored `public/config/supabase-config.json` and provide the public project values for local development. Deployments should set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, then run `npm run build:configured` so the same runtime file is generated without committing credentials. See [database documentation](docs/database.md) for schema decisions, environment setup, local migration workflow, RLS, and type generation.

Supabase owns browser session persistence and callback processing. Angular waits for `INITIAL_SESSION` before guards decide whether to show the protected shell or `/auth`, avoiding a login flash when the PWA restores an existing session. New Auth users receive a profile through a database trigger; group membership remains separate. See [authentication documentation](docs/authentication.md) for architecture, provider setup, redirects, PWA limitations, and manual validation.

Invitations use 256-bit bearer tokens while PostgreSQL stores only SHA-256 hashes. Anonymous preview, ADMIN-only creation and authenticated acceptance use narrow RPCs; acceptance links the existing member atomically and is protected against reuse and concurrent claims. See [invitation documentation](docs/invitations.md).

Groups support multiple active memberships per Profile, atomic creator-as-ADMIN setup, safe role changes, durable member deactivation/reactivation, and private avatar storage. See [groups and members documentation](docs/groups-and-members.md).

Events start as `DRAFT` and advance one step through `OPEN`, `IN_PROGRESS`, `SETTLEMENT`, and `CLOSED`. PostgreSQL enforces transitions and ADMIN authorization while Angular provides local date/time entry and exact ARS minor-unit conversion. See [event documentation](docs/events.md).

Guests are event-scoped `EventParticipant` identities with independent football/dinner intent, ADMIN-only mutations and safe cancellation. The reusable PR09 manager now runs inside each real event detail. See [guest participant documentation](docs/guest-participants.md).

Attendance confirmation resolves the caller from `auth.uid()` and independently upserts only football or dinner intent while an event is `OPEN`. The read model represents unanswered members without pre-creating rows and includes current guests. See [attendance documentation](docs/attendance.md).

Home combines the deterministic current event with the existing secure attendance read model. It shows independent football/dinner counts and an integer-derived, visibly estimated court share without creating debt or payment state. See [event dashboard documentation](docs/event-dashboard.md).

The pure Team Formation Engine converts an actual-player count into deterministic team capacities, including explicit insufficient-player and invalid-input outcomes. It performs no player assignment or persistence. See [Team Formation Engine documentation](docs/team-formation-engine.md).

Match Attendance implements the boundary between planned football intent and actual attendees who played on match day, corresponding to Screen 7 ("¿Quiénes jugaron?"). See [Match Attendance documentation](docs/match-attendance.md).

Managers mode assigns one temporary, linked GroupMember DT to every team for one event. Assignments remain separate from persistent ADMIN/MEMBER roles and prepare the secure boundary for PR17. See [Managers / DT documentation](docs/managers-dt.md).

Player Draft captures the capacity plan, auto-assigns DTs who played, authorizes each turn in PostgreSQL, prevents duplicate concurrent selections, synchronizes open phones, and completes automatically. See [Player Draft documentation](docs/player-draft.md).

Team Lineup UI renders persisted Random or Managers rosters on an original responsive football pitch, supports dynamic tabs/swipe and offers ADMIN-only atomic cross-Team swaps. See [Team Lineup UI documentation](docs/team-lineup-ui.md).

Dinner Planning preserves menu, planned purchases and purchase responsibility as non-financial context. Dinner Reality independently records actual diners and actual expense CRUD in exact minor units; it creates no debts, payments or per-person calculation. See [Dinner Planning](docs/dinner-planning.md) and [Dinner Attendance & Expenses](docs/dinner-attendance-expenses.md).

Match Settlement divides the event-specific court price only among actual PR13 players, snapshots one exact obligation per EventParticipant and remains separate from payment state. See [Match Settlement](docs/match-settlement.md).

## Roadmap

- Completed: **PR01 — Angular Project Foundation**
- Completed: **PR02 — Design System Foundations**
- Completed: **PR03 — Mobile App Shell**
- Completed: **PR04 — PWA Foundation**
- Completed: **PR05 — Supabase Foundation**
- Completed: **PR06 — Identity & Authentication**
- Completed: **PR07 — Invitations & Member Linking**
- Completed: **PR08 — Groups & Members**
- Completed: **PR09 — Guest Members**
- Completed: **PR10 — Events**
- Completed: **PR11 — Attendance**
- Completed: **PR12 — Event Dashboard**
- Completed: **PR13 — Match Attendance**
- Completed: **PR14 — Team Formation Engine**
- Completed: **PR15 — Random Team Generator**
- Completed: **PR16 — Managers / DT**
- Completed: **PR17 — Player Draft**
- Completed: **PR18 — Team Lineup UI**
- Completed: **PR19 — Dinner Planning**
- Completed: **PR20 — Dinner Attendance & Expenses**
- Completed: **PR21 — Match Settlement**
- Next: **PR22 — Dinner Settlement**

PR21 begins Milestone 6 — Liquidación y pagos with court obligations. PR22 will consume PR20's actual diner and expense sources to calculate Dinner Settlement; PR23 will add payment tracking.
