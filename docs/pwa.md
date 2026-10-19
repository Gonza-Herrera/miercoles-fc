# Miércoles FC PWA

Miércoles FC uses Angular's official Service Worker for an installable application shell. Version 1.0 keeps business data online-only and provides explicit connectivity, installation, and update experiences.

## Architecture and cache boundary

- `provideServiceWorker()` registers `ngsw-worker.js` only outside development, after startup settles or 30 seconds.
- `ngsw-config.json` prefetches the versioned HTML, manifest, CSS, and JavaScript shell and lazily caches local images/fonts.
- There are no `dataGroups`, API URL patterns, external resources, or authentication caches. Supabase responses, sessions, and private records never enter Angular Service Worker caches.
- `navigationRequestStrategy: freshness` prefers the current shell online and falls back to the cached version offline.

Offline mode is intentionally shell-only. `ConnectivityService` owns browser online/offline state, drives the persistent global notice, and exposes an explicit guard. The Supabase fetch boundary also fails fast offline, so writes are not queued, replayed, or reported as successful. Reconnecting resumes normal reads and Realtime invalidation against PostgreSQL as the authority.

## Install experience

The manifest launches `/` inside scope `/` using standalone display, Spanish metadata, and the canonical purple/ivory brand colors. Supported Chromium browsers receive a dismissible install suggestion only after `beforeinstallprompt` confirms eligibility. iOS Safari receives concise “Compartir → Agregar a inicio” guidance. Dismissal persists locally to avoid repeated prompts.

The icon set contains standard sizes from 72px to 512px, dedicated 192px/512px maskable icons, a 180px Apple touch icon, and a 48px favicon. Assets derive from the approved Miércoles FC artwork.

## Update experience

`AppUpdateService` listens for Angular `VERSION_READY`. It never reloads automatically: the user can postpone or explicitly activate the update. The prompt asks users to finish any edit before refreshing, protecting forms and draft actions from surprise reloads. A failed activation remains recoverable and offers another attempt.

## Local verification

Use a private browser window to avoid stale Service Worker state:

```bash
npm run build
npm run serve:pwa
```

Then inspect `http://localhost:4200`:

1. Application → Manifest: no validation errors; name, colors, standard and maskable icons are correct.
2. Application → Service Workers: `ngsw-worker.js` is activated and controls the page.
3. Cache Storage: only shell/static assets exist; no Supabase response or private record is cached.
4. Install on Chromium and launch standalone. On iOS Safari, verify the documented manual Add to Home Screen flow.
5. Navigate through Inicio, Partido, Cena, Pagos, event detail, draft, lineup, summary, and History.
6. After an online load, go offline and reload. The shell must render with the offline notice.
7. Attempt a mutation offline; confirm it fails with no success state and no queued replay.
8. Reconnect and confirm authoritative data and Realtime status recover.
9. Serve a second production build and verify “Más tarde” does not reload while “Actualizar” reloads only after explicit action.

Service Workers require HTTPS in production; browsers allow `localhost` as the local exception. Device-specific splash images are intentionally omitted. Offline business workflows, background sync, push notifications, and Supabase data caching are intentionally unsupported.
