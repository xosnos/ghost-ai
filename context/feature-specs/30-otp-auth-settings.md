# 30 Passwordless OTP Auth and Account Settings

**Status:** Accepted
**Date:** 2026-08-19

Replace password signup, login, and reset with email one-time codes (OTP). Collect a display name at signup. Add a signed-in settings page for email change (OTP on the new inbox, 7-day revert from the old inbox) and account deletion.

This spec enhances spec 03. Spec 03 still owns client helpers, `proxy.ts`, the two-panel auth layout, and the user menu. This spec replaces password forms and reset routes, and adds account settings.

**Implementation skills:** `supabase` (`.agents/skills/supabase/`) · `supabase-postgres-best-practices` (`.agents/skills/supabase-postgres-best-practices/`)

**Build approach:** Journey. Ship signup OTP end to end, then login OTP, then settings plus email change, then revert, then delete.

## Summary

Users sign up with a display name and email, then enter a 6-digit code from a branded Architype email before they get a session. Login is the same code flow without a password. Settings (opened from the profile avatar) lets a user change email by entering a code sent to the new address. After the change, the old inbox gets one branded message with a Revert button that works for 7 days without signing in. Users can delete their account after a fresh OTP to the current email. Owned projects cascade away with the Auth user. Password reset pages go away.

## Requirements

**User stories:**

- As a new user, I want to sign up with my name and email and confirm a code from my inbox so that nobody else can finish creating my account.
- As a returning user, I want to sign in with email and a code so that I do not have to remember a password.
- As a signed-in user, I want to open Settings from my avatar so that I can change my email or delete my account.
- As a user changing email, I want to prove I own the new inbox, and I want a 7-day undo from the old inbox if the change was not me.
- As a user leaving Architype, I want to delete my account and the projects I own.

**Acceptance criteria:**

- **AC-1:** Signup asks for display name and email. Display name is required, trimmed, 1 to 80 characters, and not unique. It is stored on the Auth user as `user_metadata.display_name`. It is never read in RLS or other authorization.
- **AC-2:** Signup does not create a session until the user enters a valid 6-digit email OTP on the same screen. Closing the tab leaves the user gated; they can request a new code.
- **AC-3:** Login asks for email only, then the 6-digit OTP on the same screen. It uses `signInWithOtp` with `shouldCreateUser: false`. No password field.
- **AC-4:** OTP emails (signup, login, email change) are branded Architype HTML. They show `{{ .Token }}` for copy/paste. They do not include a one-click magic login link.
- **AC-5:** `/forgot-password` and `/reset-password` are removed. Auth forms have no password or reset links. Bookmark hits on those paths are not public routes (unauthenticated visitors go to `/login`).
- **AC-6:** The profile avatar menu includes a Settings item that goes to `/settings`. Sign out stays. `/settings` is session-protected and uses existing editor chrome (navbar and project sidebar).
- **AC-7:** Settings shows the current email. Changing email sends a 6-digit OTP to the **new** address. The Auth email does not change until that OTP verifies. `double_confirm_changes` is false.
- **AC-8:** After a successful email change, the **old** inbox receives exactly one branded message that includes a Revert button. The button lands on a public page. Completing revert requires an explicit click (POST), not a GET, so email prefetch cannot consume the token.
- **AC-9:** A revert token is valid for 7 days, single use, and bound to that user. A newer email change invalidates any previous open revert. Success restores the old email, rewrites collaborator emails back, and revokes all sessions for that user.
- **AC-10:** `project_collaborators.email` follows the person when Auth email changes and when revert restores it. Owner access stays `projects.owner_id` (user id). If `(project_id, new_email)` already exists, drop the stale old-email row for that project.
- **AC-11:** Delete account requires a fresh OTP to the **current** email, then a typed confirmation (the user's current email). The server deletes canvas and spec Storage objects for owned projects, removes collaborator rows for that email on other people's projects, then `auth.admin.deleteUser`. Owned projects, task runs, and spec metadata cascade via existing FKs. The browser signs out.
- **AC-12:** `proxy.ts` public routes are `/login`, `/signup`, `/auth/callback`, and `/auth/revert-email`. Authenticated users visiting `/login` or `/signup` still redirect to `/editor`. Authenticated users visiting `/auth/revert-email` are **not** redirected away.
- **AC-13:** Presence, share-dialog enrichment, and AI chat keep using `user_metadata.display_name` with the existing email-local-part fallback. Signup is what fills that field going forward.

## Decision

Stay on Supabase Auth. Do not add Clerk, magic-link skip, OAuth, passkeys, or a third-party ESP (no Resend). OTP mail uses Auth's mailer and committed templates. The revert message is app-sent because Auth's `email_changed` notification cannot carry our secret token.

**Chosen option:** Email OTP plus a hashed 7-day revert token issued from a Postgres trigger on `auth.users.email`.

**Runner up:** Auth Send Email Hook for every mail. Rejected because it replaces Auth's built-in sender and needs a new ESP. OTP can stay on Auth templates.

**Also chosen:**

- OTP length 6, expiry 10 minutes (`otp_expiry = 600`). Runner up: keep the current 1 hour expiry (weaker for a code that is typed).
- One app-sent revert email. Auth `email_changed` notification stays **off** so the old inbox is not mailed twice.
- Account deletion cascades owned work (matches `projects.owner_id … ON DELETE CASCADE`). Runner up: block delete until the user empties projects. No ownership transfer in this spec.
- Integration tests for specs 22 and 27 may keep `admin.createUser({ password })` and `signInWithPassword`. That is test plumbing, not product UX.

## Auth configuration

Update `supabase/config.toml`:

- `[auth.email] enable_confirmations` can stay false. Session gating is the OTP verify step, not the confirm-signup link.
- `double_confirm_changes = false`
- `otp_length = 6`
- `otp_expiry = 600`
- Raise `[auth.rate_limit] email_sent` from `2` so local OTP resend is usable (use `30`).
- Wire templates:

```toml
[auth.email.template.magic_link]
subject = "Your Architype sign-in code"
content_path = "./supabase/templates/magic_link.html"

[auth.email.template.email_change]
subject = "Confirm your new Architype email"
content_path = "./supabase/templates/email_change.html"
```

- Do not enable `[auth.email.notification.email_changed]`.
- Uncomment `[local_smtp] smtp_port = 54325` so the revert mailer can reach Inbucket locally.

Hosted projects: copy the same HTML into the dashboard Email Templates (CLI `content_path` does not apply there). Hosted revert mail needs SMTP (`[auth.email.smtp]` or Vault-backed env on the mailer function).

## Client auth flows

Keep `app/(auth)/layout.tsx`. Forms stay client components with loading and error states, existing `AuthField`, `AuthError`, `Button`, and CSS variables. No password inputs.

### Signup (`/signup`)

1. Fields: display name, email.
2. On submit: `signInWithOtp({ email, options: { shouldCreateUser: true, data: { display_name } } })`.
3. Same screen switches to a 6-digit OTP field (`autocomplete="one-time-code"`, paste allowed) plus Resend.
4. On submit: `verifyOtp({ email, token, type: "email" })`, then `router.refresh()` and `/editor`.
5. If the email already has an account, still show the OTP step (Auth sends a code). Do not overwrite that account's display name.

### Login (`/login`)

1. Field: email.
2. `signInWithOtp({ email, options: { shouldCreateUser: false } })`.
3. Same OTP verify as signup (`type: "email"`).
4. If Auth refuses to send (no user), show a safe error: "We could not send a sign-in code. Check the address or sign up." Do not say whether the email is registered in other cases if Auth does not distinguish them.
5. Link to `/signup`. No forgot-password link.

### Remove

- `app/(auth)/forgot-password/`
- `app/(auth)/reset-password/`
- `components/auth/forgot-password-form.tsx`
- `components/auth/reset-password-form.tsx`

Keep `app/auth/callback/route.ts` for any remaining code-exchange links. Revert does not use it.

Resend: disable the button until Auth `max_frequency` has passed. Show a short cooldown. Map Auth rate-limit errors to a calm inline message.

## Settings page

### Navigation

In `components/editor/user-menu.tsx`, add a Settings item (gear icon) above Theme, linking to `/settings`. Keep Theme and Sign out.

### Route

`app/settings/page.tsx` is a server component, same data load as `app/editor/page.tsx` (current user, owned and shared projects). Wrap children in `EditorChrome`. Unauthenticated users hit `proxy.ts` and go to `/login`.

The page is not a canvas workspace: no Share, Templates, or AI sidebar chrome beyond what `EditorChrome` already hides on non-workspace views.

### Content (this spec only)

1. **Profile:** current email, read only. Display-name editing is out of scope.
2. **Change email:** new email field, send code, OTP field, success copy that the old inbox can revert for 7 days.
3. **Delete account:** danger zone. Explain that owned projects, canvases, and specs are permanently deleted. Require typing the current email, then a current-email OTP.

Use existing shadcn `Card`, `Input`, `Button`, `Dialog` as needed. Tokens from `context/ui-context.md`. Do not restyle `components/ui/*` primitives.

## Email change (new inbox OTP)

From the settings client, while signed in:

1. Validate the new email (same helper as collaborator invites: trim, lower, valid shape). Reject if it equals the current email.
2. `updateUser({ email: newEmail })`. Auth emails the **new** address using the branded `email_change` template (`{{ .Token }}`). Auth email is unchanged until verify.
3. `verifyOtp({ email: newEmail, token, type: "email_change" })`.
4. Refresh the session so JWT `email` matches. Settings shows the new email.

Do not wrap signup/login OTP in API routes. Cookie session plus `verifyOtp` is enough. Email **revert** and **delete** go through server routes because they need the admin client.

## Data model

One migration. Table `public.email_change_reversions`. Follow existing project conventions (`uuid` PK `gen_random_uuid()`, RLS on, explicit grants). `pgcrypto` for `gen_random_bytes` / `digest`.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | uuid PK | no | `default gen_random_uuid()` |
| `user_id` | uuid | no | FK `auth.users(id)` ON DELETE CASCADE |
| `old_email` | text | no | address before the change, stored lowercased |
| `new_email` | text | no | address after the change, stored lowercased |
| `token_hash` | text | no | hex SHA-256 of the raw token. Never store the raw token |
| `expires_at` | timestamptz | no | `now() + interval '7 days'` |
| `consumed_at` | timestamptz | yes | set when revert succeeds |
| `created_at` | timestamptz | no | `default now()` |

Indexes:

- unique on `token_hash`
- index on `user_id` (FK)
- partial unique on `user_id` where `consumed_at is null` (at most one open revert per user)

RLS enabled. No policies for `anon` or `authenticated`. Grant `ALL` to `service_role` only. Revoke `SELECT, INSERT, UPDATE, DELETE` from `anon` and `authenticated`. Repeat that revoke in `supabase/seed.sql` so local reset stays locked.

Do not add this table to `supabase_realtime`.

### Trigger on Auth email change

`AFTER UPDATE OF email ON auth.users`, function `public.handle_auth_user_email_change`, `SECURITY DEFINER`, `search_path = public, auth, extensions`. Fire only when `old.email is distinct from new.email`.

Skip the whole function when `current_setting('app.email_change_source', true) = 'revert'` so revert does not issue a new token to the attacker.

Otherwise, in one transaction:

1. Set `consumed_at = now()` on any open row for `new.id` (invalidates older reversions).
2. Generate a 32-byte raw token (`encode(gen_random_bytes(32), 'hex')`). Store `token_hash = encode(digest(raw, 'sha256'), 'hex')`. Insert the new row with lowercased emails and `expires_at = now() + interval '7 days'`.
3. Rewrite collaborator emails: `old.email` → `new.email` (see AC-10).
4. Notify the mailer with `pg_net.http_post` (or the local equivalent already used for worker invocation) to the Edge Function, body including `user_id`, `old_email`, `new_email`, `raw_token`, `expires_at`. Authenticate with the existing `automations` / `AUTOMATION_SECRET` pattern. Do not write the raw token to a log table.

### Collaborator rewrite helper

`public.reassign_collaborator_email(old_email text, new_email text)` `SECURITY DEFINER`, `search_path = public`.

- Lower both arguments.
- For each `project_collaborators` row matching `lower(email) = old_email`: if a row already exists for that `project_id` with `lower(email) = new_email`, delete the old-email row; else update `email` to `new_email`.
- Revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated`. Grant to `service_role` / `postgres` only. The Auth trigger and the revert RPC are the callers.

## Revert mailer

New Edge Function `account-mailer` (name may vary; keep it next to `ai-worker`). `verify_jwt = false`. Fail closed unless `AUTOMATION_SECRET` matches, same as `ai-worker`.

Sends one HTML email to `old_email`:

- Architype branding aligned with auth pages (logo via absolute `site_url` image, cyan accent, system fonts, inline CSS).
- States that the account email changed from old to new.
- Primary button: `{site_url}/auth/revert-email?token={raw_token}`.
- Copy: the button works for 7 days and does not require signing in.
- If they made the change, they can ignore the message.

SMTP:

- Local: Inbucket SMTP on the uncommented `smtp_port` (54325), from `Architype <admin@email.com>` or the local_smtp sender.
- Hosted: `ACCOUNT_SMTP_HOST`, `ACCOUNT_SMTP_PORT`, `ACCOUNT_SMTP_USER`, `ACCOUNT_SMTP_PASS`, `ACCOUNT_SMTP_FROM` (Edge Function secrets). Do not introduce Resend.

`site_url` comes from Auth `site_url` / `NEXT_PUBLIC` app origin. Local default `http://127.0.0.1:3000`.

## Revert HTTP surface

### `GET /auth/revert-email?token=…`

Public. Server Component plus a small client confirm form.

- Missing or well-formed-but-unknown token: generic expired/invalid copy. Do not reveal whether the hash exists.
- Valid unconsumed, unexpired token: show old and new email (from the row, looked up by hash via a server helper) and a **Revert email change** button.
- GET must not consume the token.

### `POST /api/account/email/revert`

Body: `{ token }`. No session required.

1. Hash the token. Load the row by `token_hash`.
2. If missing, consumed, or `expires_at <= now()`, return 400 with the same generic message.
3. `SET LOCAL app.email_change_source = 'revert'`.
4. Mark `consumed_at`.
5. `reassign_collaborator_email(new_email, old_email)` (direction reversed).
6. Admin `updateUserById` with `email: old_email` and `email_confirm: true` so Auth does not start another change OTP.
7. Admin global sign-out / revoke sessions for that user (`auth.admin.signOut(userId, 'global')` or equivalent). JWT leftover until expiry is why this step is required (Supabase: deleting or changing a user does not by itself invalidate existing access tokens).
8. Return 200. The page tells the user to sign in with the restored email.

Idempotent on a second POST of the same token: still 400 generic (already consumed).

## Delete account

### `POST /api/account/delete/otp`

Cookie session required. Sends a fresh OTP to the current email (`signInWithOtp` with `shouldCreateUser: false`, or Auth `reauthenticate()`). 401 if no user.

### `POST /api/account/delete`

Cookie session required. Body: `{ email, token }` where `email` must match the current user email (case-insensitive) as the typed confirmation.

1. `verifyOtp` for that email and token.
2. List owned project ids.
3. Admin Storage: delete `canvas` objects `{projectId}.json` (and `canvas/{projectId}.json` if that key exists) and `specs` objects under `{projectId}/`.
4. Delete `project_collaborators` rows where `lower(email)` equals the user's email (so they disappear from other owners' share lists). Use a SECURITY DEFINER helper or the admin client; browser RLS cannot delete other projects' collaborator rows.
5. `auth.admin.deleteUser(userId)`. Owned `projects` cascade, then `task_runs`, `project_specs`, and remaining collaborator rows on those projects.
6. Clear cookies / `signOut`. Return 200.

No transfer of owned projects. No "delete my collaborator access only" mode.

## Proxy

Update `publicRoutes` in `proxy.ts`:

```ts
const publicRoutes = ["/login", "/signup", "/auth/callback", "/auth/revert-email"];
```

Keep the authenticated-user redirect from `/login` and `/signup` to `/editor`. Exclude `/auth/revert-email` from that redirect (same idea as today's `/reset-password` exception).

`/settings` is protected like `/editor`.

## Email HTML

Commit:

- `supabase/templates/magic_link.html` — heading, short explanation, large `{{ .Token }}`, ignore-if-not-you line. Optional greeting `{{ .Data.display_name }}`.
- `supabase/templates/email_change.html` — same pattern for the new address; may use `{{ .NewEmail }}`.
- Shared layout partial is optional; duplicated HTML is fine if it stays small.

Dark-friendly, inline styles, no remote CSS. Logo: absolute URL to the existing favicon or a small PNG under `public/`.

The revert message HTML lives with the Edge Function (not a GoTrue template) so it can embed the raw token.

## Value sourcing

| AC need | Source |
| --- | --- |
| Display name | Signup input → `signInWithOtp` `options.data.display_name` → `auth.users.raw_user_meta_data` |
| Login/signup OTP | Auth `{{ .Token }}` / `verifyOtp` `type: "email"` |
| Email-change OTP | Auth `{{ .Token }}` / `verifyOtp` `type: "email_change"` |
| Current email on settings | Session `user.email` after `getUser()` |
| Revert token | Trigger `gen_random_bytes`; only hash stored; raw value mailed once |
| Revert expiry | `now() + interval '7 days'` on insert |
| Old / new email in revert mail | Trigger payload from `old.email` / `new.email` |
| Collaborator email | `project_collaborators.email` updated by `reassign_collaborator_email` |
| Delete confirmation | Body `email` must equal session email |
| Delete OTP | Fresh Auth OTP to current email |
| Storage cleanup | Owned `projects.id` → canvas key and specs prefix |
| Session kill on revert/delete | Auth admin global sign-out |

## Edge cases

- Wrong OTP: inline error, stay on the code step, do not start a new session.
- Expired OTP: ask them to resend.
- New email already used by another Auth user: show Auth's error in safe copy ("that email cannot be used").
- Trigger mailer failure: email is already changed. Keep the reversion row. Log server-side. Settings copy still says the old inbox can revert; support can resend only by issuing a new change. Follow-up if silent failure is too sharp: a retry queue. Not in this spec.
- Revert after 7 days: generic invalid page.
- Attacker signed in on `/auth/revert-email`: still allowed; POST revert must work and then revoke that session.
- Display name of `""` after trim: block submit.
- Specs 22 and 27 test helpers: unchanged.

## Out of scope

- OAuth, passkeys, magic-link auto login
- Editing display name or avatar on settings
- Billing
- Transferring owned projects before delete
- New email vendor
- Rewriting `context/architecture-context.md` public-route list (do that when this spec is implemented)

## Build plan

1. **Auth config and templates (AC-4, AC-5, AC-12).** `config.toml`, HTML templates, Inbucket SMTP port, remove reset routes, update `proxy.ts`.
2. **Signup OTP and display name (AC-1, AC-2, AC-13).** Rewrite `SignupForm`.
3. **Login OTP (AC-3).** Rewrite `LoginForm`.
4. **Settings shell (AC-6).** User menu link, `/settings` with `EditorChrome`.
5. **Email change OTP (AC-7).** Settings change-email UI.
6. **Reversion table, trigger, collaborator rewrite, mailer (AC-8, AC-9, AC-10).** Migration, seed grants, Edge Function, `pg_net` (or documented local substitute).
7. **Revert page and POST (AC-8, AC-9, AC-12).** Prefetch-safe confirm + admin restore + global sign-out.
8. **Delete account (AC-11).** OTP, typed email, Storage cleanup, admin deleteUser.

## Check when done

- Signup requires display name and a verified email OTP before `/editor`
- Login is email plus OTP; no password UI
- Forgot/reset routes are gone
- OTP emails in Inbucket show Architype branding and a 6-digit code, not a login link
- Settings opens from the avatar; change email requires OTP on the new inbox
- Old Inbucket inbox shows one revert message; GET does not consume; POST restores email and collaborator rows within 7 days
- Delete requires current-email OTP and typed email; owned projects and storage objects are gone; the user cannot use the old session
- `pnpm lint` and `pnpm build` pass
- Spec 22 and spec 27 integration tests still pass with their password test helpers

## Follow-up

- Copy templates into the hosted Auth dashboard
- Set hosted SMTP for `account-mailer`
- Optional: display-name field on settings
- Optional: durable retry if revert mail `pg_net` fails
- After implementation, update `context/architecture-context.md` public routes and `context/progress-tracker.md` to Accepted/Complete
