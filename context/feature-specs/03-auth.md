Supabase Auth is already provisioned. Wire it into the Next.js app: client utilities, auth pages, middleware route protection, and user menu.

## Design

Dark theme only. Auth pages use the app's existing CSS variables.

Sign-in, sign-up, and password reset pages:

- large screens: simple two-panel layout
- left: compact logo, tagline, short text-only feature list
- right: centered form
- small screens: form only
- no gradients
- no oversized hero sections
- no feature cards
- no scroll-heavy layouts

Keep the layout minimal and professional.

## Implementation

### Supabase Client Utilities

Create two client helpers in `lib/supabase/`:

- `client.ts` — browser client using `createBrowserClient` from `@supabase/ssr`. Singleton pattern, no custom cookie config needed.
- `server.ts` — server client using `createServerClient` from `@supabase/ssr` with `next/headers` cookies.

Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.

### Middleware

Create `middleware.ts` at the project root.

- Create a Supabase server client with cookie handling on the request/response.
- Call `supabase.auth.getUser()` to refresh the session.
- Define public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Redirect unauthenticated users to `/login` for all other routes.
- Redirect authenticated users from `/` to `/editor`.
- Export a `config.matcher` that skips static assets, `_next`, and favicon.

### Auth Pages

Create route groups:

- `app/(auth)/login/page.tsx` — email + password sign-in form
- `app/(auth)/signup/page.tsx` — email + password sign-up form
- `app/(auth)/forgot-password/page.tsx` — email input to request password reset
- `app/(auth)/reset-password/page.tsx` — new password form (user lands here from email link)
- `app/(auth)/layout.tsx` — shared two-panel auth layout

All forms are client components with loading and error states. Use the existing Input and Button components.

### Auth Callback

Create `app/auth/callback/route.ts` to handle the email confirmation and password reset redirect. Exchange the code for a session and redirect to `/editor` or `/reset-password`.

### Root Page

Update `/`:

- authenticated users redirect to `/editor`
- unauthenticated users redirect to `/login`

### User Menu

Add a user menu component to the editor navbar right section:

- Shows user avatar (first letter of email) in a circular badge
- Dropdown on click with sign-out action
- Uses `supabase.auth.signOut()` then redirects to `/login`

## Dependencies

install: @supabase/supabase-js, @supabase/ssr

## Check When Done

- `middleware.ts` exists at the project root
- all routes are protected except public auth paths
- auth pages use CSS variables with no hardcoded colors
- Supabase client utilities exist in `lib/supabase/`
- password reset flow works (request + update)
- user menu in navbar with sign-out
- `npm run build` passes
