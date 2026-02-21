# Authentication

Authentication is handled by **Supabase Auth** with cookie-based sessions. The app uses `@supabase/ssr` for server-side session handling.

## Login page

- **URL:** `/login`
- **Access:** Unauthenticated users are redirected here from protected routes. Authenticated users hitting `/login` are redirected to `/dashboard`.

### Behavior

1. **Form:** Email and password (both required).
2. **Submit:** Calls `supabase.auth.signInWithPassword({ email, password })`.
3. **Success:** Redirect to `/dashboard` and `router.refresh()`.
4. **Error:** Displays `authError.message` above the submit button.
5. **Branding:** "SkyWorks" and "Charter Operations" with aircraft icon; footer text "Part 135 Charter Management · Staff only".

### Implementation

- Client Component (`app/(auth)/login/page.tsx`).
- Uses Supabase **browser client** from `@/lib/supabase/client`.

## Route protection (proxy)

Auth is enforced via **`proxy.ts`** at the project root (Next.js 16 proxy convention). The proxy runs on every request matched by its config (excluding static assets) and:

- **`/`** → Redirect to `/dashboard` if authenticated, else `/login`.
- **Protected routes** (all non-public paths) → Redirect to `/login` if not authenticated.
- **`/login`** → Redirect to `/dashboard` if already authenticated.

Protected areas include: dashboard, intake, quotes, clients, aircraft, fleet-forecasting. The proxy also refreshes the Supabase session (cookies) via `createServerClient` from `@supabase/ssr`.

## Session and sign out

- **Sidebar:** "Sign out" in the footer calls `supabase.auth.signOut()`, then redirects to `/login` and refreshes.
- Session is maintained via Supabase cookies; the SSR client in `lib/supabase/server.ts` is used in Server Components and API routes to get the current user when needed.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set for auth and API access.

## Related

- [Dashboard](dashboard.md) — post-login landing page
- Supabase Auth: [Server-side auth with cookies](https://supabase.com/docs/guides/auth/server-side-rendering)
