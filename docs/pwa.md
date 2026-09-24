# Miércoles FC PWA

PR04 adds the installable Progressive Web App foundation using Angular's official Service Worker. It caches the structural application shell; it does not provide offline business workflows.

## Architecture

- `@angular/service-worker` provides the generated production Service Worker.
- `provideServiceWorker()` registers `ngsw-worker.js` only when Angular is not running in development mode.
- `ngsw-config.json` defines versioned application-shell and local static-asset caching.
- `public/manifest.webmanifest` describes install identity, launch behavior, colors, and icons.
- Standard `npm start` remains a development build without Service Worker registration.

Registration uses `registerWhenStable:30000`, allowing startup to settle while guaranteeing registration within 30 seconds in production.

## Manifest and launch experience

The manifest launches `/` within scope `/` using `display: standalone`. The native launch experience uses:

- Theme color `#6d45c6`, matching `--color-primary` / `--color-purple-500`.
- Background color `#faf9f5`, matching `--color-background` / `--color-ivory-50`.

Manifest JSON and HTML metadata cannot consume CSS custom properties, so these values are intentionally duplicated from the canonical Design System tokens. Update all three locations together if the brand colors change.

No JavaScript splash screen or custom install prompt is included.

## Icon strategy

All icon assets derive from the approved `icon-miercoles-fc.png` artwork:

- Standard PWA sizes from 72px through 512px.
- Dedicated 192px and 512px maskable variants with a solid brand background and the football mark kept inside the safe zone.
- A 180px Apple touch icon.
- A replacement 48px multi-platform favicon.

The manifest declares standard and maskable purposes separately so each platform can choose the correct treatment.

## Cache strategy

The `app` asset group prefetches the HTML entry point, manifest, favicon, and generated CSS/JavaScript bundles as one versioned application shell. The `assets` group lazily caches local images, icons, and fonts when requested, then prefetches their changed versions on updates.

There are deliberately no `dataGroups`, external URL patterns, API rules, or authentication caches. Future Supabase and user-specific data must receive an explicit policy based on real security and offline requirements.

## Local verification

Use a private/incognito browser window to avoid stale Service Worker state:

```bash
npm run build
npm run serve:pwa
```

Then open `http://localhost:4200` and use browser developer tools:

1. Open **Application → Manifest** and confirm the name, standalone display, colors, and icon previews have no errors.
2. Open **Application → Service Workers** and confirm `ngsw-worker.js` is activated and controls the page.
3. Open **Application → Cache Storage** and confirm Angular application/version caches exist.
4. Confirm the browser offers installation where supported, then launch the installed app and verify the header, content, safe areas, and bottom navigation.
5. Navigate through Inicio, Partido, Cena, and Pagos.
6. After one successful online load, enable **Network → Offline** and reload. The structural shell and placeholder routes should still start from cached assets.
7. Return online and unregister the Service Worker or clear site data when testing is complete.

Service Workers require HTTPS in production; browsers allow `localhost` as the local-development exception.

## iOS and Safari

The document includes a 180px Apple touch icon, app title, standalone-capable metadata, and `viewport-fit=cover`. The App Shell continues to use safe-area insets for the header and bottom navigation. Device-specific splash images are intentionally omitted in favor of the maintainable manifest-driven native launch experience.

## Current limitations

- Installation UI and standalone presentation vary by browser and operating system.
- No physical-device installation is asserted by automated checks.
- Only static application-shell assets are available offline.
- Events, attendance, payments, authentication, Supabase data, synchronization, background sync, push notifications, and update prompts are not implemented or cached.
