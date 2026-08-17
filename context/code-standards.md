# Code Standards

## General

- Keep modules small and single-purpose.
- Fix root causes — do not layer workarounds.
- Do not mix unrelated concerns in one component or route.
- Respect the system boundaries defined in `architecture-context.md`.

## TypeScript

- Strict mode is required throughout the project.
- Avoid `any`; use explicit interfaces or narrowly scoped types.
- Validate unknown external input at system boundaries before trusting it.
- Use `interface` for object contracts.

## Next.js

- Default to React Server Components.
- Add `"use client"` only when the component needs browser interactivity, hooks, or real-time state.
- Keep route handlers focused on a single responsibility.
- AI generation belongs in a durable Supabase Queue consumed by an Edge Function, not in request handlers.

## Styling

- Use CSS custom property tokens defined in `globals.css` — no raw Tailwind color classes like `zinc-*` or hardcoded hex values.
- Reference tokens through their Tailwind utility names: `bg-base`, `text-copy-primary`, `border-surface-border`, `text-brand`, etc.
- Maintain the border radius scale: `rounded-xl` for small elements, `rounded-2xl` for cards, `rounded-3xl` for modals.

## API Routes

- Validate and parse request input before any logic runs.
- Enforce auth and project ownership checks before any mutation.
- Return consistent, predictable response shapes.
- Keep route handlers thin. Validate access, enqueue the task transactionally, make a best effort worker invocation, and return the run ID.

## Data and Storage

- Project metadata and relationships belong in PostgreSQL via the Supabase client.
- Canvas snapshots and generated specs belong in Supabase Storage; the database stores only the storage path reference.
- Do not store large generated content directly in the database.
- Task run records are first-class relational data. Verify ownership before returning or subscribing to a run, and let only trusted server or Edge Function code update lifecycle state.
- Explicitly grant browser roles only the table privileges they need. RLS does not replace `GRANT` statements, and new tables are not automatically exposed to the Data API.
- Index every foreign key column and every column used by RLS. Wrap `auth.uid()` in `select` inside policies so PostgreSQL evaluates it once.

## Supabase Queues and Edge Functions

- Use a durable basic queue for AI work. Do not use an unlogged queue.
- Create the task run and queue message in one database transaction so neither can exist without the other.
- Place the worker at `supabase/functions/ai-worker/index.ts` and shared handlers in `supabase/functions/_shared/`.
- Authenticate worker calls with a named secret key and `@supabase/server`. Do not make the worker public.
- Read queue messages with a visibility timeout longer than the maximum configured processing duration. Archive only after success or terminal failure.
- Use `EdgeRuntime.waitUntil` for processing after the worker returns its accepted response. Keep Supabase Cron as the recovery invocation path.
- Give external AI calls an application deadline below the Edge Function wall clock limit so failure state can be persisted before shutdown.
- Call OpenRouter from the Edge Function worker for all model inference. Use model ID `openrouter/free`. Do not add a Google AI, Anthropic, or OpenAI client.
- Persist `queued`, `running`, `retrying`, `completed`, and `failed` state in `task_runs`. Do not treat ephemeral Broadcast messages as the source of truth.
- Make every side effect idempotent per task-run ID. Stop retrying permanent failures and archive messages after the configured attempt limit.
- Pin Edge Function package versions in `supabase/functions/deno.json` and commit the Deno lockfile.
- Keep secret keys and provider credentials server only. Never return them or embed them in client code. Store `OPENROUTER_API_KEY` as a Supabase Edge Function secret.

## File Organization

- `lib/` — shared infrastructure: Supabase client, auth helpers, utilities.
- `supabase/functions/` — queue workers, asynchronous AI workflows, and Edge Function only shared code.
- `components/` — UI composition only; no business logic.
- `app/api/` — route handlers for auth, Edge Function invocation, and persistence.
- Name files after the responsibility they contain, not the technology.
