# Miércoles FC

A mobile-first PWA for organizing weekly football matches, teams, dinner expenses and payments.

## Project overview

Miércoles FC will help groups of friends coordinate their weekly match and the meal that follows it. The product roadmap includes group and event management, attendance, team organization, shared expenses, and payment tracking.

This repository currently contains the application foundation, Design System, mobile application shell, installable PWA infrastructure, Supabase/PostgreSQL backend contract, passwordless identity, secure invitations, and group/member administration. Match, dinner, and payment workflows remain on the roadmap.

## Current status

**PR08 — Groups & Members**

PR01–PR07 established the Angular application, Design System, responsive mobile shell, installable PWA, Supabase/PostgreSQL foundation, passwordless identity, and secure invitations. PR08 adds multiple-group administration, durable member lifecycle, role management, private avatar storage, and invitation integration.

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

Angular PWA, Supabase infrastructure, passwordless identity, invitations, and group/member administration are configured. Event-specific workflows arrive in later roadmap stages.

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

| Route            | Purpose                                                 |
| ---------------- | ------------------------------------------------------- |
| `/auth`          | Passwordless sign-in                                    |
| `/auth/callback` | Magic Link and OAuth callback                           |
| `/invite/:token` | Public invitation preview and explicit acceptance       |
| `/`              | Protected Home placeholder inside the application shell |
| `/match`         | Protected Match placeholder                             |
| `/dinner`        | Protected Dinner placeholder                            |
| `/payments`      | Protected Payments placeholder                          |
| `/invitations`   | Minimal protected ADMIN invitation surface              |
| `/groups`        | Protected group selection and administration            |
| `/groups/new`    | Atomic group creation                                   |
| `/groups/:id`    | Group detail, members, lifecycle and invitations        |
| `/design-system` | Development showcase outside primary navigation         |

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

## Roadmap

- Completed: **PR01 — Angular Project Foundation**
- Completed: **PR02 — Design System Foundations**
- Completed: **PR03 — Mobile App Shell**
- Completed: **PR04 — PWA Foundation**
- Completed: **PR05 — Supabase Foundation**
- Completed: **PR06 — Identity & Authentication**
- Completed: **PR07 — Invitations & Member Linking**
- Current: **PR08 — Groups & Members**
- Next: **PR09 — Guest Members**

Guest event members, event workflows, realtime behavior, and offline business data will be implemented only in later roadmap stages.
