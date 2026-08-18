# 27 Spec Generation Flow

**Status:** Partial

**Open acceptance gap:** Generation and persistence are implemented, but no retained integration suite verifies queue retry and artifact idempotency against the local stack.

Add spec generation to the durable Supabase Queue and shared Edge Function worker, including persistent run status and artifact persistence.

### Implementation

1. Spec generation route

Create or update `POST /api/ai/spec`.

It should:

- accept and validate `roomId`, `chatHistory`, `nodes`, and `edges`
- authenticate the current user
- resolve project access from `roomId`; do not trust a client-supplied project ID
- transactionally create a queued `spec` run and send its trusted payload to `ai-generation`
- invoke `ai-worker` as a best effort fast path after the queue transaction commits
- return `{ runId }` with HTTP 202

1. Spec metadata and storage

Ensure `project_specs` exists with:

- `id` (uuid, primary key)
- `task_run_id` (uuid, unique foreign key to `task_runs`)
- `project_id` (uuid, foreign key to `projects`)
- `file_path` (text storage path)
- `created_at` (timestamp)

Add separate indexes on `task_run_id` through its unique constraint and on `project_id` for the foreign key. Enable RLS, add project member read access, and grant only the required table privileges explicitly.

Store generated Markdown in the private `specs` Supabase Storage bucket at the deterministic path `specs/{projectId}/{runId}.md`. Store only metadata and the storage path in PostgreSQL.

1. Spec generation handler

Create `supabase/functions/_shared/generate-spec.ts` and dispatch to it from `supabase/functions/ai-worker/index.ts` when the trusted queue message kind is `spec`.

It should:

- validate the trusted queue payload containing `runId`, `projectId`, `roomId`, `userId`, `chatHistory`, `nodes`, and `edges`
- verify the task run matches the expected project, user, and kind
- let the queue worker own visibility timeout, lifecycle, attempt count, and message acknowledgement
- use OpenRouter's OpenAI-compatible HTTP API
- prefer `openrouter/free`; explicit fallback models must use free OpenRouter variants
- generate a Markdown technical spec from the canvas and chat context
- upload the Markdown to Supabase Storage and create the matching `project_specs` row before marking the run completed
- publish progress to the project-scoped `ai-status` Broadcast channel
- use the unique `project_specs.task_run_id` link to make execution idempotent so retries cannot create duplicate specs
- upsert the deterministic run path and insert metadata on conflict by `task_run_id` so a retry cannot leave duplicate artifacts
- classify provider, network, and storage failures so the worker retries only transient failures

### Scope Limits

- Do not add frontend logic or a spec editor.
- Do not derive access from client-provided project IDs.
- Do not store Markdown content in `task_runs` or `project_specs`.
- Do not create a new AI provider abstraction. OpenRouter is the only provider.
- Do not add a provider-specific token route.
- Do not change existing canvas or chat data models.

### Notes

- Store `OPENROUTER_API_KEY` as a Supabase Edge Function secret.
- Call OpenRouter at `https://openrouter.ai/api/v1`. Prefer `openrouter/free`; explicit fallbacks must be free OpenRouter models. Do not use a paid model, a Google AI SDK client, or `GOOGLE_AI_API_KEY`.
- The task run is the source of lifecycle state; Realtime Broadcast is only for ephemeral room-wide progress.
- Keep work within Supabase Edge Function execution limits rather than modeling an unbounded workflow.

### Check When Done

- `POST /api/ai/spec` validates input and returns a persisted `runId` with HTTP 202.
- The run can be observed through authorized Realtime Postgres Changes.
- The `spec` queue handler persists one Markdown artifact and one metadata row per completed run.
- Failed generation records a sanitized error and does not create a completed spec record.
- A transient failure leaves the queue message available for another delivery without duplicating the artifact.
- `supabase functions serve ai-worker` works locally.
- TypeScript and build pass.
