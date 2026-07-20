# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 07: Wire Editor Home (complete)

## Current Goal

- Next feature spec (08-editor-workspace-shell) — build the `/editor/[roomId]` workspace shell with server-side access checks.

## Completed

- Boilerplate cleanup (globals.css, page.tsx, public SVGs)
- 01-design-system: globals.css tokens, lib/utils.ts cn() helper, shadcn/ui components (Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea), lucide-react, Radix UI primitives
- 02-editor-chrome: EditorNavbar (fixed top bar, sidebar toggle, PanelLeftOpen/Close), ProjectSidebar (floating overlay, slides in from left, My Projects / Shared tabs, New Project button)
- 03-auth: Supabase Auth integration — sign-in, sign-up, forgot-password, reset-password pages with two-panel layout; middleware route protection; auth callback handler; UserMenu component in editor navbar; root page redirect logic
- 04-project-dialogs: EditorHome (heading + New Project button, no card wrapper), Create/Rename/Delete project dialogs, useProjectDialogs hook (dialog/form/loading state), ProjectDialogContext for cross-component wiring, ProjectDialogs switch, slugify helper + live slug preview, sidebar renders mock projects with rename/delete actions on owned items only (shared items have no actions), mobile backdrop scrim + tap-outside-to-close, editor page renders EditorHome as EditorChrome children. Mock data only — no API/persistence. Lint + build pass.
- 05-supabase-schema — `projects` and `project_collaborators` tables created via Supabase migration with owner-scoped RLS, indexes, and `owner_id DEFAULT auth.uid()`.
- 06-project-apis — backend-only REST routes for projects. `GET /api/projects` lists the signed-in user's owned projects; `POST /api/projects` creates a project (defaults missing/blank name to `Untitled Project`, returns 201). `PATCH /api/projects/[projectId]` renames; `DELETE /api/projects/[projectId]` deletes. Both mutation routes fetch the row first and return 404 if missing, 403 if the caller is not the owner, 401 if unauthenticated. Server helpers live in `lib/projects/queries.ts` (`listOwnedProjects`, `createProject`, `getProject`, `renameProject`, `deleteProject`) and the shared `Project` shape + snake→camel mapper live in `lib/projects/types.ts`. Routes use the cookie-scoped server Supabase client (RLS provides a second layer of enforcement). UI is intentionally untouched — still on mock data until spec 07. `npm run build` passes; both routes register as dynamic (`ƒ /api/projects`, `ƒ /api/projects/[projectId]`).
- 07-wire-editor-home — editor home sidebar and dialogs now use real project data. `app/editor/page.tsx` is a server component that fetches owned projects via `listOwnedProjects(user.id)` and shared projects via `listSharedProjects(user.email)` in parallel, then passes both lists + `currentUserId` through `EditorChrome` to `ProjectSidebar`. New `hooks/use-project-actions.ts` replaces the mock `use-project-dialogs.ts`: create generates a slugified room ID preview (slug + short unique suffix), calls `POST /api/projects`, and navigates to `/editor/[projectId]` (project ID doubles as the Liveblocks room ID per spec 10); rename calls `PATCH` and `router.refresh()`; delete calls `DELETE` and redirects to `/editor` if deleting the active workspace, otherwise `router.refresh()`. All three dialogs now display server errors inline. `ProjectSidebar` accepts `ownedProjects`/`sharedProjects`/`currentUserId` props typed as `Project[]` and derives ownership from `project.ownerId === currentUserId` so rename/delete still appear only on owned items. Mock-data.ts and use-project-dialogs.ts deleted. `npm run build` passes.

## Open Questions

- (Resolved) `listSharedProjects` RLS access — SELECT policies on `projects` and `project_collaborators` now allow owner OR collaborator (matched by `auth.jwt() ->> 'email'`), so shared projects populate for invited collaborators. Mutations remain owner-only.

## Design Decisions

- **Project routing stays UUID-based** per spec 07 ("project ID and room ID stay aligned"). The `/editor/[roomId]` route resolves projects by UUID; `POST /api/projects` returns the UUID and the client navigates to `/editor/<uuid>`. The slug shown in the Create dialog preview is **display-only** and is not persisted or used for routing.
- **Sidebar shows a derived slug, not the UUID.** `ProjectSidebar` renders `slugify(project.name)` (or `untitled` when empty) as the secondary line under each project name. The real `project.id` is still used as the React key and for rename/delete callbacks.
- **Rename/delete buttons: hover-reveal on desktop, always visible on mobile.** Root cause of the "missing buttons" report: the action container used `opacity-0 group-hover:opacity-100` with no touch fallback, so on mobile/touch the buttons stayed at `opacity:0` permanently. Fix: `md:opacity-0 md:group-hover:opacity-100` — buttons are always visible below the `md` breakpoint and reveal on hover above it. The Tailwind v4 `group-hover` variant generates the expected `.group-hover\:opacity-100:is(:where(.group):hover *)` rule, so desktop hover works.
- **Create dialog label corrected** from "Room ID preview" to "Slug preview" to stop implying the slug is the URL/Liveblocks room ID. The `createSlug` is now plain `slugify(createName)` (no random suffix) so it matches the sidebar's derived slug exactly.

## Architecture Decisions

- Tailwind v4 CSS-first config — design tokens defined as CSS custom properties in globals.css, mapped to Tailwind via @theme inline.
- shadcn/ui components authored directly (no CLI); live in components/ui/.
- ProjectSidebar is a fixed overlay (does not push page content) positioned below the navbar.
- Auth uses Supabase Auth (not Clerk). Cookie-based sessions via @supabase/ssr. Middleware at project root handles session refresh and route protection. Public routes: /login, /signup, /forgot-password, /reset-password, /auth/callback.
- Editor page at /editor is a server component that fetches user then renders client EditorChrome with userEmail prop.
- Auth route pages (`app/(auth)/*/page.tsx`) are Server Components that render client form components. Avoid `"use client"` on `page.tsx` itself — Next.js wraps client pages in `ClientPageRoot`, which requires `workStore` for `searchParams` instrumentation and can throw in WebContainer environments (Bolt/StackBlitz).
- Database layer uses Bolt's integrated Supabase database (PostgreSQL) instead of Prisma. Schema is applied via the Supabase migration tool, not a Prisma schema file. All tables use RLS with owner-scoped policies.
- Artifact storage uses Supabase Storage instead of Vercel Blob. Canvas snapshots and generated specs are stored in Supabase Storage buckets, with the storage path stored as a reference column on the corresponding Supabase table.
- Background tasks continue to use Trigger.dev (not Supabase Edge Functions). Supabase Edge Functions have a 150s/400s wall clock limit and 2s CPU time limit, which is insufficient for durable multi-step AI generation workflows. Trigger.dev provides retries, realtime status streaming, and run-scoped tokens that would need to be rebuilt.

## Bug Fixes

- Fixed `cookies was called outside a request scope` error on `/editor`. Root cause: each query function in `lib/projects/queries.ts` called `createClient()` (which calls `cookies()`) independently, and when `app/editor/page.tsx` ran two queries via `Promise.all`, the concurrent branches lost Next.js's async request-store context (`workUnitAsyncStorage`), so `cookies()` threw `throwForMissingRequestStore`. Fix: call `cookies()` exactly once per request to create a single Supabase client, then pass that client into `getCurrentUser(supabase?)` and all query functions (`listOwnedProjects(supabase, ownerId)`, `createProject(supabase, params)`, etc.). Updated editor page and both API route handlers to use this shared-client pattern. Build passes; `/editor` remains dynamic (`ƒ`).
- Fixed `Failed to list shared projects: 'project' is not an embedded resource in this request` error on `/editor`. Two root causes: (1) the `project:...` embedded-resource join syntax in `listSharedProjects` was not recognized by PostgREST; (2) RLS policies on `projects` and `project_collaborators` only allowed project OWNERS to SELECT, so an invited collaborator could never read their shared projects. Fix: rewrote `listSharedProjects` to fetch matching `project_id`s from `project_collaborators` then fetch those project rows via `.in("id", projectIds)` (two simple queries instead of an embedded join); broadened both SELECT policies to allow owner OR collaborator (matched by `auth.jwt() ->> 'email'`) while keeping mutations owner-only. Applied via migration `fix_shared_projects_rls_and_access`. Build passes.
- Fixed `infinite recursion detected in policy for relation "projects"` error. Root cause: the broadened SELECT policies from the previous fix created a mutual recursion — `projects` SELECT subqueried `project_collaborators`, and `project_collaborators` SELECT subqueried `projects`; both tables have RLS enabled, so evaluating either policy re-entered the other indefinitely. Fix: extracted the cross-table ownership/collaborator checks into two `SECURITY DEFINER` SQL functions (`is_project_owner(uuid)`, `is_project_collaborator(uuid)`) that execute as their owner and bypass RLS internally, breaking the cycle. All policies on both tables now call these functions instead of subquerying the other table directly. Functions are granted `EXECUTE` only to `authenticated`. Applied via migration `fix_rls_recursion_with_security_definer_funcs`. Build passes; policies verified in `pg_policies`.

## Session Notes

- All shadcn components use var(--token) inline styles rather than Tailwind aliases, since @theme inline maps are defined but Tailwind v4 utility generation from CSS vars requires the exact variable names.
- Supabase Auth email confirmation is OFF by default in the provisioned instance. This is intentional for the current development phase. The signup flow handles both cases gracefully (immediate session or "check your email" state). Before implementing the collaborator-by-email sharing feature (spec 09), email confirmation should be re-evaluated to prevent users from claiming collaborator access with unverified emails.
- Fixed Bolt/WebContainer crash: `Invariant: Expected workStore to exist when handling searchParams in a client Page` by converting auth pages from client pages to Server Component shells + client forms (`LoginForm`, `SignupForm`, `ForgotPasswordForm`, `ResetPasswordForm`).
- Fixed post-auth redirect loop: call `router.refresh()` before `router.push("/editor")` so middleware sees the session cookie; corrected middleware `setAll` to match `@supabase/ssr` (cookies only, no headers arg).
