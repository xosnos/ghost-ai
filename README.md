# Ghost AI

Ghost AI is a collaborative system design workspace. Teams build architecture diagrams on a shared canvas, ask an AI agent to create or revise designs, and generate downloadable Markdown technical specifications.

## Features

- Supabase Auth with protected project workspaces
- Owner and collaborator access controls
- React Flow canvas with realtime nodes, edges, cursors, selections, and presence
- Starter architecture templates and canvas autosave
- Durable AI design and spec generation with Supabase Queues, Cron, and Edge Functions
- OpenRouter powered architecture generation
- Persisted Markdown specs with preview and secure download
- Light and dark themes

Feature specifications 01 through 29 are implemented. See `context/progress-tracker.md` for acceptance gaps that still need follow up.

## Stack

- Next.js 15.4, React 19, and TypeScript
- Tailwind CSS 4 and shadcn style UI primitives
- React Flow
- Supabase Auth, Postgres, Realtime, Storage, Queues, Cron, and Edge Functions
- OpenRouter

## Local setup

Requirements:

- Node.js 22 or later
- Docker
- Supabase CLI

Install dependencies and start Supabase:

```bash
npm install
supabase start
```

Copy `.env.example` to `.env.local`. Fill the Supabase URL, anon key, and service role key from `supabase status`.

Copy `.env.example` to `supabase/functions/.env`. Set `OPENROUTER_API_KEY`. For local development, keep `AUTOMATION_SECRET=local-dev-automation-secret` so it matches the value seeded into Supabase Vault.

Start the app:

```bash
npm run dev
```

Open http://localhost:3000. Unauthenticated users are redirected to `/login`.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js client and server | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Next.js client and server | Browser safe Supabase key |
| `SUPABASE_SERVICE_ROLE_KEY` | Next.js server | Admin enrichment, task enqueueing, and worker invocation |
| `AUTOMATION_SECRET` | Next.js server and Edge Function | Authenticates worker fast path and Cron calls |
| `OPENROUTER_API_KEY` | Edge Function | AI model access |

Never expose the service role key, automation secret, or OpenRouter key to browser code.

## Checks

```bash
npm run lint
npm run build
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
