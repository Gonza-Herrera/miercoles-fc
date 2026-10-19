# Production release runbook

This document prepares Miércoles FC `1.0.0` for release. It is not evidence that a production deployment, tag, DNS change, or live migration has happened.

## Required production values

Configure these values in Netlify for the **Builds** scope. The publishable key is intentionally browser-visible; never add a Supabase secret or `service_role` key.

- `SUPABASE_URL`: the HTTPS project URL.
- `SUPABASE_PUBLISHABLE_KEY`: an `sb_publishable_...` key.

`npm run build:configured` validates both values and writes the ignored runtime file. Netlify publishes `dist/miercoles-fc/browser`; `netlify.toml` supplies the SPA fallback, security headers, and cache rules.

## Supabase dashboard checklist

1. Add the final HTTPS site URL under Authentication → URL Configuration → Site URL.
2. Add exact production and approved Deploy Preview callback URLs to Redirect URLs. Do not use a broad wildcard for production.
3. Update the Google OAuth authorized JavaScript origins and redirect URIs after the public domain exists.
4. Confirm RLS remains enabled on all exposed tables and browser code uses only the publishable key.
5. Confirm production migrations match the repository before release. Use the established migration process; do not edit production ad hoc.
6. Review Supabase Security and Performance advisors and resolve release-blocking findings.
7. Configure custom SMTP before relying on branded or production-volume magic-link email.
8. Confirm Realtime publication contains only the intended tables, backups/PITR match the selected plan, usage alerts are configured, and connection/log retention limits are understood.

## Netlify and domain checklist

1. Import the repository without changing the committed build command or publish directory.
2. Keep Deploy Previews enabled, but scope preview environment values and Supabase redirect URLs explicitly.
3. Use the Netlify-provided HTTPS domain for the first release or add a domain the project actually owns. No custom domain is required.
4. For a custom domain, add the DNS records shown by Netlify, wait for propagation and certificate issuance, choose one canonical host, and redirect the alternate host to it.
5. Replace the Supabase Site URL and exact Auth/Google redirect origins with the final canonical HTTPS URL, then rebuild. Manifest `start_url` and `scope` remain `/` and require no host-specific edit.
6. Verify direct navigation to `/auth/callback`, `/groups/:id`, `/events/:id`, `/events/:id/draft`, `/events/:id/lineup`, and History routes.
7. Confirm `index.html`/runtime config are not cached while hashed assets are immutable, and retain the prior successful deploy for one-click rollback.

## Release sequence

1. Start from a clean, reviewed commit and run `npm ci`.
2. Run `npm run quality` and the manual checks in `qa-checklist.md`.
3. Build using production environment values with `npm run build:configured`.
4. Create a Deploy Preview and execute the smoke plan below.
5. Obtain explicit release approval.
6. Deploy production, then repeat the smoke test against the canonical HTTPS URL.
7. Only after validation, create the `v1.0.0` tag and release notes. Keep rollback to the previous known-good Netlify deploy available.

## Observability and support fallback

Angular's global browser error listeners report unexpected failures through `AppErrorHandler`. The handler writes only an error class and timestamp to the browser console; it deliberately excludes messages, stacks, request bodies, tokens, invitation URLs, emails, and names. Supabase dashboard logs remain the server-side source for Auth, API, Realtime, and PostgreSQL failures.

No external client monitoring provider is configured for `1.0.0`. If production support needs a report, collect the UTC time, affected route, role, browser/OS, reproducible steps, and a screenshot without private data; correlate that time in Supabase/Netlify logs. Adding a third-party monitor requires a separate privacy review, sampling/redaction policy, CSP update, and user disclosure.

## Smoke test plan

- New user: magic link and Google login return to `/auth/callback`, create/load the profile, and reach Home without a login flash.
- Returning user: close and reopen the installed PWA; the persisted session restores before routing.
- Admin: create/open an event, manage a guest, record attendance, create teams, complete a DT draft, record Dinner reality, finalize settlements, update a payment, close the event, and inspect History.
- Member: verify authorized reads/actions work and ADMIN-only controls/actions remain unavailable.
- Multi-device: change attendance, draft, teams, Dinner, payments, closure, and History on one device; verify the other refreshes without a full reload.
- PWA: install on Android/Chromium and iOS Safari, launch standalone, verify safe areas, then deploy a preview update and confirm the optional update prompt.
- Offline: load once online, disconnect, reload the shell, verify the offline notice, and confirm every attempted server mutation fails without false success; reconnect and reload authoritative data.

## Rollback

If smoke tests fail, stop promotion and restore the previous Netlify deploy. Database migrations require a separately reviewed forward fix unless a tested, data-safe rollback is explicitly available. Never roll back by deleting production data.
