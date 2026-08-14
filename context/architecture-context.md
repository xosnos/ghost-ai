# Architecture Context

## Stack

| Layer            | Technology              | Role                                                           |
| ---------------- | ----------------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 + TypeScript | Full-stack app with server/client boundaries                   |
| UI               | Tailwind + shadcn/ui    | Component composition and styling                              |
| Auth             | Supabase Auth           | User identity and route protection                             |
| Database         | Supabase (PostgreSQL)   | Relational metadata: projects, collaborators, specs, task runs |
| Canvas           | Supabase Realtime + React Flow | Real-time collaborative canvas, presence, and cursors          |
| Background tasks | Trigger.dev             | Durable AI generation workflows                                |
| Artifact storage | Supabase Storage        | Canvas snapshots and generated Markdown specs                  |

## System Boundaries

- `app/api` — Authenticated request handlers: input validation, ownership checks, task triggering, and persistence.
- `trigger` — Long-running background jobs: AI design generation and spec generation.
- `lib` — Shared infrastructure: Supabase client, access control helpers, and utilities.
- `components` — UI composition: canvas surfaces, sidebars, dialogs, and interactive elements.
- `data` — Legacy local directory. Not used for new artifacts.

## Storage Model

- **Database**: metadata, ownership, relationships, and task run records.
- **Supabase Storage**: generated artifacts — canvas snapshots at `canvas/{projectId}.json` and specs at `specs/{projectId}/{specId}.md`.
- Project records, spec records, and task run records belong in PostgreSQL.
- Canvas content and Markdown output are stored in and retrieved from Supabase Storage.
- The storage path is stored in the database (`canvasStoragePath`, `filePath`) as the reference to the artifact.

## Auth and Collaboration Model

- Every project has a single owner (Supabase Auth user ID).
- Projects can include additional collaborators.
- Only authenticated users can access protected routes.
- Only the owner or a collaborator can mutate project resources.
- Realtime channel access is gated by the existing Supabase Auth session and `hasProjectAccess` verification — no separate token flow is needed.
- Realtime Presence is keyed by the authenticated user ID so each collaborator has a distinct presence entry. The payload includes identity metadata and `thinking`. Live cursor positions are sent on the same channel via Broadcast (`cursor:move`), not Presence `track()`, because Presence is not designed for high frequency mouse updates.
- Node and edge `selected` state is local to each collaborator. Broadcast canvas sync omits `select` changes so one person's click does not select the same node for everyone else. Remote selection is sent separately as Broadcast `selection:change` with the selected node IDs. Other clients draw a ring in that collaborator's presence color (the same color as their avatar and cursor). Local chrome (resize handles, color toolbar, node text border) stays on the local `selected` flag only.
- Auth is handled via `@supabase/ssr` with cookie-based sessions and Next.js middleware.
- Route protection: middleware checks session on every request, redirects unauthenticated users to `/login`.
- Public routes: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
- Collaborator management (`/api/projects/[projectId]/collaborators`): invite/remove are owner-only (enforced in the route handler). Listing requires project membership. `get_project_collaborators` returns the owner first (from `projects.owner_id`) then invited collaborators, with Auth profile enrichment. The owner is not a `project_collaborators` row and cannot be removed.

## Starter System Designs

- Prebuilt templates are static canvas snapshots stored in the codebase.
- Templates are loaded into the active Realtime channel when a user imports one.
- Import can occur on canvas creation or from within the editor at any time.
- Template data follows the same node/edge schema as user-created canvas content.
- Templates do not require a separate database record; they are resolved by template ID at import time.

## AI Generation Model

### Design Generation

- Input: user prompt, project context, and current canvas state.
- Execution: durable background task via Trigger.dev.
- Output: structured node and edge updates written into the shared Realtime channel via Broadcast.

### Spec Generation

- Input: current canvas graph and project context.
- Execution: durable background task via Trigger.dev.
- Output: Markdown technical spec saved to Supabase Storage and linked to the project in the database.

## Invariants

1. Request handlers do not run long-lived AI work — that belongs in background tasks.
2. Metadata and large generated artifacts are stored in separate layers.
3. Auth and ownership are enforced at every mutation boundary.
4. Client components are used only where browser interactivity or real-time state requires them.
5. The canvas schema must remain consistent between user-created content and imported templates.
