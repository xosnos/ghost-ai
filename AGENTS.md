<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, features, and scope
2. `context/architecture-context.md` — system structure, boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography, canvas design, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context files, update the relevant file before continuing.

## Cursor Cloud specific instructions

Ghost AI is a single Next.js 16 app (`pnpm dev`, port 3000) backed by **Supabase** (Auth, Postgres, Realtime, Storage, Queues, Cron, and Edge Functions). OpenRouter is the only external AI provider (`nvidia/nemotron-3.5-lightning:free` primary, `openrouter/free` fallback). Route protection and session refresh run through `proxy.ts` (Next.js 16 proxy convention). Biome (`@biomejs/biome`) handles linting, formatting, and import organization; pnpm is the project package manager. Features through spec 29 are implemented. Liveblocks and Trigger.dev are not used.

The VM image already has the Docker engine, pnpm, and the Supabase CLI installed; the update script runs `pnpm install`. Bring the stack up in this order:

1. Ensure the Docker daemon is running (run `docker ps`; if it fails, start it with `sudo dockerd &` and wait a few seconds). `/etc/docker/daemon.json` is pre-configured for `fuse-overlayfs` with the containerd-snapshotter feature disabled, and `iptables` is set to the legacy backend — this is required for Docker to work in this VM.
2. From `/workspace`, run `supabase start`. This launches the local Supabase containers, applies everything in `supabase/migrations/`, and runs `supabase/seed.sql`. Get the local URL/keys anytime with `supabase status`.
3. Create `.env.local` (gitignored) if it is missing, pointing at the local stack. Do not hardcode keys here — read the current values from `supabase status` (fields `API URL`, `publishable key`, and `secret key`) and write them in:
    - `NEXT_PUBLIC_SUPABASE_URL` — the `API URL` (local default `http://127.0.0.1:54321`)
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the `publishable key` (`sb_publishable_...`)
    - `SUPABASE_SECRET_KEY` — the `secret key` (`sb_secret_...`, server-only; required for collaborator listing and Auth admin enrichment in spec 09). Never expose this to the browser.
    - `AUTOMATION_SECRET` — `local-dev-automation-secret`, matching the value seeded into Vault for local worker invocation.
4. Copy `.env.example` to `supabase/functions/.env`, then set `OPENROUTER_API_KEY`. Keep the local `AUTOMATION_SECRET` aligned with the Vault `automations` secret seeded by `supabase/seed.sql`.
5. `pnpm dev` → http://localhost:3000. Unauthenticated visits redirect to `/login`; sign up/in creates a real Supabase Auth user (email confirmation is off locally).

Non-obvious gotchas:

- **`supabase/seed.sql` is load-bearing locally, not just sample data.** Hosted Supabase auto-grants DML on `public` tables to the `anon`/`authenticated` roles; the local CLI does not, so without the seed's `GRANT`s every query fails with `permission denied for table projects` and `/editor` shows "Application error: a server-side exception". If you recreate the DB, re-run `supabase start`/`supabase db reset` so the seed re-applies (or apply `supabase/seed.sql` manually).
- **`/editor/[roomId]` is implemented** (spec 08). Share dialog (spec 09) opens from the workspace navbar Share button. Collaborator list enrichment needs `SUPABASE_SECRET_KEY` in `.env.local`.
- AI generation needs both `AUTOMATION_SECRET` and `OPENROUTER_API_KEY`. Hosted projects must also set Vault `ai_worker_url` and use a unique automation secret shared with the Edge Function.
- `pnpm lint` (`biome check .`) and `pnpm build` are the standard repository checks. Biome (`@biomejs/biome`) is used for linting, formatting, and import organization.
