# Miércoles FC

A mobile-first PWA for organizing weekly football matches, teams, dinner expenses and payments.

## Project overview

Miércoles FC will help groups of friends coordinate their weekly match and the meal that follows it. The product roadmap includes group and event management, attendance, team organization, shared expenses, and payment tracking.

This repository currently contains the application foundation, Design System, mobile application shell, and installable PWA infrastructure. It does not yet implement those business workflows.

## Current status

**PR04 — PWA Foundation**

PR01 established the Angular foundation, PR02 added the Design System, and PR03 introduced the responsive mobile shell. PR04 adds a standards-based Web App Manifest, Angular Service Worker, app-shell caching, and approved Miércoles FC icon assets. Supabase and business features are not implemented.

## Tech stack

- Angular 22 with standalone components
- TypeScript in strict mode
- Angular Router with lazy-loaded feature routes
- SCSS
- Vitest
- ESLint and Prettier
- Node.js 24

Supabase is planned for a later roadmap stage; Angular PWA support is now configured.

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

| Route            | Purpose                                         |
| ---------------- | ----------------------------------------------- |
| `/`              | Home placeholder inside the application shell   |
| `/match`         | Match placeholder                               |
| `/dinner`        | Dinner placeholder                              |
| `/payments`      | Payments placeholder                            |
| `/design-system` | Development showcase outside primary navigation |

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
npm run serve:pwa     # Serve a production configuration with Service Worker support
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

## Roadmap

- Completed: **PR01 — Angular Project Foundation**
- Completed: **PR02 — Design System Foundations**
- Completed: **PR03 — Mobile App Shell**
- Current: **PR04 — PWA Foundation**
- Next: **PR05 — Supabase Foundation**

Product features, Supabase, authentication, realtime behavior, and offline business data will be implemented only in later roadmap stages.
