# QA checklist for v1.0.0

Record device/browser versions, tested commit, environment, result, and evidence for each run. Use `PASS`, `FAIL`, or `NOT RUN`; never infer a pass.

## Automated gates

- [ ] Clean install: `npm ci`
- [ ] Lint: `npm run lint`
- [ ] Format: `npm run format:check`
- [ ] Unit/integration tests: `npm test`
- [ ] Production compilation and budgets: `npm run build`
- [ ] Dependency audit reviewed: `npm audit --omit=dev`
- [ ] Supabase Security and Performance advisors reviewed

## Mobile and accessibility

- [ ] 320px, 375px, 390px, 768px, and desktop widths: no horizontal overflow or clipped actions
- [ ] iOS Safari and Android Chromium: header/bottom navigation respect safe areas
- [ ] Keyboard-only: logical focus order, visible focus, dialogs trap focus and restore it on close
- [ ] Screen reader: headings, navigation labels, status/error announcements, form labels, and button names are understandable
- [ ] Text zoom to 200% keeps content and actions usable
- [ ] Reduced-motion preference removes nonessential motion
- [ ] Loading, empty, recoverable error, permission error, and offline states are understandable

## PWA and resilience

- [ ] Manifest has no browser validation errors and standard/maskable icons render correctly
- [ ] Installation works from supported Chromium and manual iOS instructions are accurate
- [ ] Standalone launch uses the correct name, icon, colors, and session restoration
- [ ] First online load activates `ngsw-worker.js`; cached shell launches offline
- [ ] Supabase API/auth responses and private user data do not appear in Cache Storage
- [ ] Offline mutations fail and never show success
- [ ] Reconnection restores live data/realtime status
- [ ] A new build produces an optional update prompt; “Más tarde” does not reload; “Actualizar” reloads only after user action

## Lighthouse and production preview

- [ ] Run Lighthouse against a production Deploy Preview for Performance, Accessibility, Best Practices, SEO, and PWA/installability diagnostics
- [ ] Investigate every error and document accepted warnings with owner/rationale
- [ ] Complete the role-based and multi-device smoke plan in `production-release.md`
