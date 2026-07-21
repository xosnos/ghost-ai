<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

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

Ghost AI is a single Next.js app (`next dev --turbopack`, port 3000) backed by **Supabase** (Auth + Postgres) — the only external service the current code touches. Liveblocks, Trigger.dev, and AI providers are documented future scope (specs 08–12) and are not installed or wired up yet.

The VM image already has the Docker engine and the Supabase CLI installed; the update script only runs `npm install`. Bring the stack up in this order:

1. Ensure the Docker daemon is running (run `docker ps`; if it fails, start it with `sudo dockerd &` and wait a few seconds). `/etc/docker/daemon.json` is pre-configured for `fuse-overlayfs` with the containerd-snapshotter feature disabled, and `iptables` is set to the legacy backend — this is required for Docker to work in this VM.
2. From `/workspace`, run `supabase start`. This launches the local Supabase containers, applies everything in `supabase/migrations/`, and runs `supabase/seed.sql`. Get the local URL/keys anytime with `supabase status`.
3. Create `.env.local` (gitignored) if it is missing, pointing at the local stack. The local anon key is the standard Supabase demo JWT and is stable across restarts:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
4. `npm run dev` → http://localhost:3000. Unauthenticated visits redirect to `/login`; sign up/in creates a real Supabase Auth user (email confirmation is off locally).

Non-obvious gotchas:

- **`supabase/seed.sql` is load-bearing locally, not just sample data.** Hosted Supabase auto-grants DML on `public` tables to the `anon`/`authenticated` roles; the local CLI does not, so without the seed's `GRANT`s every query fails with `permission denied for table projects` and `/editor` shows "Application error: a server-side exception". If you recreate the DB, re-run `supabase start`/`supabase db reset` so the seed re-applies (or apply `supabase/seed.sql` manually).
- **`/editor/[id]` returns 404 by design.** The per-project workspace route (spec 08) is not built yet; project creation still succeeds and the project appears in the `/editor` sidebar. This 404 is expected scope, not a regression.
- **Lint has a pre-existing failure.** `npm run lint` reports a `prefer-const` error in `middleware.ts` that predates environment setup; `npm run build` passes cleanly.