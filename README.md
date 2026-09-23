# Miércoles FC

A mobile-first PWA for organizing weekly football matches, teams, dinner expenses and payments.

## Project overview

Miércoles FC will help groups of friends coordinate their weekly match and the meal that follows it. The product roadmap includes group and event management, attendance, team organization, shared expenses, and payment tracking.

This repository currently contains only the application foundation. It does not yet implement those business workflows.

## Current status

**PR01 — Angular Project Foundation**

The current implementation provides a standalone Angular application, strict TypeScript, lazy-loaded routing, Vitest, ESLint, Prettier, and a minimal Home feature. Supabase integration and PWA capabilities are planned, but neither is implemented in PR01.

## Tech stack

- Angular 22 with standalone components
- TypeScript in strict mode
- Angular Router with lazy-loaded feature routes
- SCSS
- Vitest
- ESLint and Prettier
- Node.js 24

Planned technologies include Supabase and Angular PWA support.

## Architecture

Application code follows a feature-oriented structure:

```text
src/app/
├── core/       # Future application-wide singleton infrastructure
├── shared/     # Future reusable, domain-agnostic building blocks
├── features/   # Independently evolvable application features
│   └── home/
├── app.config.ts
├── app.routes.ts
└── app.ts
```

Only directories with useful code are committed. `core/` and `shared/` will be introduced when a real concern belongs there.

The root component is an application host. The root route lazy-loads the Home feature, while each future feature can own its pages, components, models, data access, state, and routes. Feature-specific code should remain inside its feature rather than moving into `shared/`.

Local and feature state will follow a Signals-first approach using `signal()`, `computed()`, and `effect()` when they solve a real state need. PR01 intentionally introduces no artificial state or state-management library.

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
npm run lint          # Run Angular and TypeScript linting
npm run format        # Format supported project files
npm run format:check  # Check formatting without changing files
```

## Testing

Run the Vitest unit test suite once:

```bash
npm test
```

Foundation tests cover the root application host, the Home page, and routing behavior.

## Roadmap

The current milestone is **PR01 — Angular Project Foundation**. The next planned milestone is **PR02 — Design System Foundations**. Product features, Supabase, authentication, realtime behavior, and PWA installation will be implemented only in later roadmap stages.
