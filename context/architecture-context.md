# Architecture Context

## Stack

| Layer            | Technology                    | Role                                                           |
| ---------------- | ----------------------------- | -------------------------------------------------------------- |
| Framework        | Next.js 16 + TypeScript       | Full-stack app with server/client boundaries                   |
| UI               | Tailwind + shadcn/ui          | Component composition and styling                              |
| Auth             | Supabase Auth                 | User identity and route protection                             |
| Database         | Supabase (PostgreSQL)         | Relational metadata: projects, collaborators, specs, task runs |
| Canvas           | Supabase Realtime + React Flow | Real-time collaborative canvas, presence, and cursors          |
| Background tasks | Supabase Queues + Edge Functions + Cron | Durable delivery and asynchronous AI generation                |
| Artifact storage | Supabase Storage              | Canvas snapshots and generated Markdown specs                  |
| AI models        | OpenRouter                    | Unified model gateway for design and spec generation           |

## System Boundaries

- `app/api` — Authenticated request handlers: input validation, ownership checks, transactional task enqueueing, and best effort worker invocation.
- `supabase/functions` — Queue consumers and asynchronous AI workflows: design generation and spec generation.
- Supabase Queues — Durable delivery, visibility timeouts, and retryable AI work messages.
- Supabase Cron — Recovery path that invokes the queue worker when an immediate invocation is missed or interrupted.
- `lib` — Shared infrastructure: Supabase client, access control helpers, and utilities.
- `components` — UI composition: canvas surfaces, sidebars, dialogs, and interactive elements.
- `data` — Legacy local directory. Not used for new artifacts.

## Storage Model

- **Database**: metadata, ownership, relationships, and task run records.
- **Supabase Storage**: generated artifacts — canvas snapshots at `canvas/{projectId}.json` and specs at the retry safe path `specs/{projectId}/{runId}.md`.
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

### Provider

- All model inference goes through OpenRouter (`https://openrouter.ai/api/v1`) from the Edge Function worker, using the Deno-compatible AI SDK.
- Store `OPENROUTER_API_KEY` as a Supabase Edge Function secret. Keep it out of browser code and API responses. `.env.local` is only for local Next.js development.
- Use `openrouter/free` as the model ID. That is OpenRouter's Free Models Router: it picks an available free model that supports the request (tool calling, structured outputs, and similar). Do not pin a paid model or a specific `:free` variant unless a later spec changes this.
- Treat free-router rate limits and temporary unavailability as transient failures so the queue can retry. Do not call Google AI, Anthropic, or OpenAI APIs directly, and do not add a second provider client.

### Design Generation

- Input: user prompt, project context, and current canvas state.
- Execution: the API transactionally creates a task run and a durable queue message, then invokes the shared AI worker as a low latency fast path. The worker registers processing with `EdgeRuntime.waitUntil`.
- Output: structured node and edge updates written into the shared Realtime channel via Broadcast.

### Spec Generation

- Input: current canvas graph and project context.
- Execution: the same queue and worker path as design generation, dispatched by the task kind.
- Output: Markdown technical spec saved to Supabase Storage and linked to the project in the database.

### Task Run Lifecycle

- The API route authenticates the caller and resolves project access from the route input. One database function then creates the `task_runs` row and sends the validated work payload to a durable basic queue in the same transaction.
- The `task_runs.id` UUID is the public run ID. No provider-specific run token or token endpoint is required.
- After enqueueing, the API invokes the `ai-worker` Edge Function as a best effort fast path. A Supabase Cron job also invokes the worker on a short interval so persisted messages recover from a missed invocation or terminated worker.
- The worker reads one message with a visibility timeout longer than the configured maximum job duration. It archives the message only after terminal success or failure. A transient failure leaves the message for another delivery.
- The worker moves the run through `queued`, `running`, `retrying`, `completed`, or `failed` and records attempt count, timestamps, and a sanitized error message when applicable.
- Project members track authorized `task_runs` rows through Supabase Realtime Postgres Changes. A partial unique index permits only one active AI run per project. Room-wide progress details remain on the project-scoped `ai-status` Broadcast channel.
- Queue messages contain the trusted task payload and are not exposed to browser clients. The browser receives only the task-run ID and its RLS filtered status row.
- The worker accepts only a named secret (`AUTOMATION_SECRET` / Vault `automations`) through `withSupabase({ auth: "secret:automations" })`. Its function config disables the legacy gateway JWT check because secret key authentication happens in the handler. Cron reads the worker URL from Vault (`ai_worker_url`) and the same automation secret. Neither value belongs in browser code.
- Processing must be idempotent for a task-run ID. Retries are bounded by queue delivery count. Edge work must remain under 256 MB memory, 2 seconds CPU time per request, and the deployment tier wall clock limit of 150 seconds on Free or 400 seconds on paid plans.
- Each AI provider call has an application deadline below the platform wall clock limit so the worker has time to record retry state before shutdown. If normal generation cannot stay within that budget, Edge Functions are not a suitable execution layer for that workload.

## Invariants

1. Request handlers do not run AI generation. They enqueue work for Supabase Edge Functions.
2. Metadata and large generated artifacts are stored in separate layers.
3. Auth and ownership are enforced at every mutation boundary.
4. Client components are used only where browser interactivity or real-time state requires them.
5. The canvas schema must remain consistent between user-created content and imported templates.
