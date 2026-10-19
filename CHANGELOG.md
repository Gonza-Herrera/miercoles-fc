# Changelog

All notable changes to Miércoles FC are documented here.

## [1.0.0] - Unreleased

### Added

- Complete weekly football, teams/draft, Dinner, settlement, payment, closure, and History workflows.
- Passwordless Supabase Auth, invitations, groups/members, strict RLS-backed operations, and multi-device Realtime invalidation.
- Installable Angular PWA with static offline shell, connectivity feedback, safe online-only writes, and user-controlled update prompts.
- Reproducible Netlify configuration, CI quality gates, release runbook, QA checklist, and smoke-test plan.

### Security

- Browser configuration accepts only an HTTPS Supabase URL and public publishable key.
- Private Supabase responses are excluded from service-worker caching.
- Baseline production security and cache headers are declared in `netlify.toml`.

This entry describes the `1.0.0` release candidate. No production deployment or Git tag is implied.
