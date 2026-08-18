# Architype

Architype is a collaborative AI system design workspace. Teams build architecture diagrams on a shared canvas, ask an AI agent to create or revise designs, and generate downloadable Markdown technical specifications.

## Features

- Supabase Auth with protected project workspaces
- Owner and collaborator access controls
- React Flow canvas with realtime nodes, edges, cursors, selections, and presence
- Starter architecture templates and canvas autosave
- Durable AI design and spec generation with Supabase Queues, Cron, and Edge Functions
- OpenRouter powered architecture generation
- Persisted Markdown specs with preview and secure download
- Light and dark themes

Feature specifications 01 through 29 are implemented. See `context/progress-tracker.md` for acceptance gaps that still need follow-up.

## Stack

- Next.js 16.3, React 19, and TypeScript
- Tailwind CSS 4 and shadcn style UI primitives
- React Flow
- Supabase Auth, Postgres, Realtime, Storage, Queues, Cron, and Edge Functions
- OpenRouter
- Biome for linting, formatting, and import organization
- pnpm for package management

## Local setup

Requirements:

- Node.js 22 or later
- pnpm 9 or later
- Docker
- Supabase CLI

Install dependencies and start Supabase:

```bash
pnpm install
supabase start
```

Copy `.env.example` to `.env.local`. Fill the Supabase URL, anon key, and service role key from `supabase status`. Set `AUTOMATION_SECRET=local-dev-automation-secret` so it matches the Vault value from `supabase/seed.sql`.

Copy `.env.example` to `supabase/functions/.env`. Set `OPENROUTER_API_KEY`. For local development, keep `AUTOMATION_SECRET=local-dev-automation-secret` so it matches the value seeded into Supabase Vault.

Start the app:

```bash
pnpm dev
```

Open http://localhost:3000. Unauthenticated users are redirected to `/login`.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js client and server | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Next.js client and server | Browser safe Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Next.js server | Admin enrichment, task enqueueing, and worker invocation (server-only) |
| `AUTOMATION_SECRET` | Next.js server and Edge Function | Authenticates worker fast path and Cron calls |
| `OPENROUTER_API_KEY` | Edge Function | AI model access |

Never expose the secret key, automation secret, or OpenRouter key to browser code.

## Checks

```bash
pnpm lint           # Check linter and formatting rules with Biome
pnpm lint:fix       # Check and apply safe fixes with Biome
pnpm format         # Format codebase with Biome
pnpm format:check   # Verify formatting with Biome
pnpm build          # Next.js production build check
```

## Project layout

- `app/`: Next.js pages and route handlers
- `components/editor/`: canvas, workspace, AI, and spec UI
- `hooks/`: realtime, task status, autosave, and project hooks
- `lib/`: Supabase clients, access checks, and data helpers
- `supabase/functions/`: AI queue worker and generation handlers
- `supabase/migrations/`: database, RLS, Storage, Queue, and Cron changes
- `context/feature-specs/`: feature specifications 01 through 29
- `context/`: product, architecture, UI, standards, and progress documentation

## Hosted setup

Before enabling AI generation in a hosted Supabase project:

1. Set a unique Vault secret named `automations`.
2. Set the same value as the Edge Function secret `AUTOMATION_SECRET`.
3. Set Vault secret `ai_worker_url` to the hosted `ai-worker` function URL.
4. Set `OPENROUTER_API_KEY` as an Edge Function secret.
5. Confirm the `ai-worker-recovery` Cron job receives HTTP 202 responses.
