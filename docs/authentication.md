# Miércoles FC authentication

PR06 implements passwordless identity with Supabase Auth. Authentication answers who the user is; group membership and roles remain separate and will be linked by PR07.

```text
auth.users 1:1 profiles 0:N group_members
```

Nothing in this layer infers `ADMIN`, `MEMBER`, or event-manager status from Auth metadata.

## Browser architecture

`AuthService` is the single source of truth for the current session, user, and profile. It listens to Supabase `onAuthStateChange` and exposes read-only Angular Signals with three explicit states:

- `INITIALIZING`: Supabase is still processing the callback URL or restoring persisted browser storage;
- `AUTHENTICATED`: a valid session exists;
- `UNAUTHENTICATED`: initial restoration completed without a session.

The application root displays a neutral loading screen during `INITIALIZING`. Guards await the same initialization promise instead of treating an unresolved session as signed out. This prevents the auth page from flashing before a persisted PWA session is restored.

The browser client explicitly enables Supabase's supported `persistSession`, `autoRefreshToken`, and `detectSessionInUrl` behavior. The application never writes access or refresh tokens itself and never logs sessions or callback credentials.

## Sign-in flows

Magic Links use `signInWithOtp` with `emailRedirectTo` set to `/auth/callback`. New email identities may sign up automatically. The UI remains on the auth page and displays a confirmation state after Supabase accepts the request.

Google uses `signInWithOAuth({ provider: 'google' })` with the same callback route. Google SDKs and provider tokens are not handled directly by the application.

The installed client uses Supabase's browser implicit flow. Its default Magic Link template can therefore continue using `{{ .ConfirmationURL }}`. Supabase processes callback credentials before emitting `INITIAL_SESSION`; the callback page only waits for centralized initialization and performs safe navigation.

An optional `returnUrl` is accepted only when it is an internal path that does not point back into `/auth`. External, protocol-relative, and auth-loop destinations fall back to `/`. PR07 reuses this mechanism for `/invite/:token`: authentication returns to the invitation preview but never accepts it automatically.

## Profile bootstrap

The migration `bootstrap_profiles_from_auth_users` installs an `AFTER INSERT` trigger on `auth.users`. The trigger creates `public.profiles` in the same database transaction and uses `ON CONFLICT DO NOTHING` for idempotency. It also backfills any pre-existing Auth users without profiles.

The trigger is a narrowly scoped `SECURITY DEFINER` function in the unexposed `private` schema with an empty `search_path` and revoked public execution. Display names may use provider `full_name` or `name` as presentation data, then fall back to the email prefix or `Jugador`. Metadata is never used for authorization, and no avatar URL or role is trusted during bootstrap.

Authenticated clients can select only their own profile through the existing RLS policy. Profile insertion remains unavailable to browser roles.

## Route behavior

- `/`, `/match`, `/dinner`, and `/payments` require an authenticated session.
- `/auth` is for unauthenticated visitors and redirects authenticated users into the app.
- `/auth/callback` lets the Supabase client finish session establishment and then redirects safely.
- `/design-system` remains an independent development showcase.

Logout calls `supabase.auth.signOut()`, clears only application identity state, and returns to `/auth`. Supabase remains responsible for its own token storage cleanup.

## Required Supabase configuration

In **Authentication → URL Configuration** configure:

- local development Site URL: `http://localhost:4200`;
- local redirect URLs: `http://localhost:4200/auth/callback` and `http://127.0.0.1:4200/auth/callback` (the committed local configuration permits these callback paths through local-only wildcards);
- production Site URL: the exact HTTPS deployment origin;
- production redirect URL: `https://your-domain.example/auth/callback`.

Email authentication and Magic Links must remain enabled. Production email delivery should use a project-owned SMTP provider rather than relying on Supabase's development-oriented default sender.

## Required Google configuration

Google authentication needs manual provider credentials and must not be committed:

1. Create a **Web application** OAuth client in Google Auth Platform.
2. Add `http://localhost:4200` and the production origin under authorized JavaScript origins.
3. Add the Supabase callback below under authorized redirect URIs:

   ```text
   https://fercjcyanrohphilxqyp.supabase.co/auth/v1/callback
   ```

4. Enable Google in **Supabase → Authentication → Providers** and enter the Google client ID and client secret there.

The Google secret belongs only in provider configuration, never in Angular runtime configuration.

## PWA and account recovery

Sessions are persisted by Supabase for the application origin, so normal reloads, browser restarts, and PWA reopenings restore the session before protected content renders. The service worker caches only static application assets; Supabase Auth and API requests are not cached.

OAuth return-window behavior varies across mobile operating systems and installed-PWA implementations. The flow uses standard HTTPS redirects and does not assume that the provider always returns directly to the standalone window. If a platform keeps browser and standalone storage isolated, reopening the PWA may require another Magic Link or Google sign-in.

Account recovery is re-authentication with the same email or Google identity on another device. There is no application password or password-reset screen. The stable Supabase Auth user ID resolves the same profile and its PR07-linked memberships.

## Manual validation

1. Configure hosted redirect URLs and the Google provider.
2. Open `/payments` signed out and confirm the app redirects to `/auth?returnUrl=%2Fpayments`.
3. Request a Magic Link and confirm the sent state appears without navigation.
4. Open the email link and confirm the callback returns to `/payments`.
5. Close and reopen the browser or installed PWA and confirm no login flash appears.
6. Sign out from the header account panel and confirm protected content disappears.
7. Repeat Google login on a supported mobile browser and note whether the OS returns to the browser or standalone PWA window.
