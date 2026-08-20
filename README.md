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

Copy `.env.example` to `.env.local`. Fill the Supabase URL, anon key, and service role key from `supabase status`. Set `AUTOMATION_SECRET=local-dev-automation-secret` so it matches the Vault value from `supabase/seed.sql`. Keep the `RESEND_API_KEY` placeholder so the CLI can load `[remotes.production.auth.email.smtp]` without a real sending key.

Copy `.env.example` to `supabase/functions/.env`. Set `OPENROUTER_API_KEY`. For local development, keep `AUTOMATION_SECRET=local-dev-automation-secret` so it matches the value seeded into Supabase Vault.

Start the app:

```bash
pnpm dev
```

Open <http://localhost:3000>. Unauthenticated users are redirected to `/login`.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Next.js client and server | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Next.js client and server | Browser safe Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Next.js server | Admin enrichment, task enqueueing, and worker invocation (server-only) |
| `AUTOMATION_SECRET` | Next.js server and Edge Function | Authenticates worker fast path and Cron calls |
| `OPENROUTER_API_KEY` | Edge Function | AI model access |
| `RESEND_API_KEY` | Supabase CLI / GitHub Actions | Resend sending key used as hosted Auth SMTP password (placeholder locally) |

Never expose the secret key, automation secret, OpenRouter key, or Resend key to browser code. Hosted Auth URLs live in `supabase/config.toml`.

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
- `.github/workflows/`: hosted Auth config push on `main`
- `context/feature-specs/`: feature specifications 01 through 29
- `context/`: product, architecture, UI, standards, and progress documentation

## Hosted setup

Before enabling AI generation in a hosted Supabase project:

1. Set a unique Vault secret named `automations`.
2. Set the same value as the Edge Function secret `AUTOMATION_SECRET`.
3. Set Vault secret `ai_worker_url` to the hosted `ai-worker` function URL.
4. Set Vault secret `account_mailer_url` to the hosted `account-mailer` function URL.
5. Set `OPENROUTER_API_KEY` as an Edge Function secret. Set `SITE_URL` and Resend `ACCOUNT_SMTP_*` as Edge Function secrets for `account-mailer`.
6. Confirm the `ai-worker-recovery` Cron job receives HTTP 202 responses.

### Hosted Supabase deploy

The [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) deploys from `main` when **Deploy to production** is enabled:

- New migrations in `supabase/migrations/`
- Edge Functions declared in `supabase/config.toml` (`ai-worker`, `account-mailer`)
- Storage buckets declared in `config.toml` (Architype creates buckets in migrations instead)

Auth, API, templates, and `seed.sql` are **not** applied by that integration. Working directory is `.` (`supabase/` is at the repo root). Do not also run `supabase db push` or `supabase functions deploy` on `main`; those race the integration. `supabase functions deploy --prune` is not part of the integration; run it once from a machine if a dashboard-only function must be deleted.

Merges to `main` that change `supabase/config.toml` or `supabase/templates/**` (or a manual `workflow_dispatch`) run `.github/workflows/deploy-supabase.yml`, which only runs `supabase --yes config push` (Auth templates, Resend SMTP, JWT flags, and remotes Auth URLs from `config.toml`). Enable a required GitHub check from the integration (or Automatic branching) if you want PRs blocked on migration failures.

Add these repository **secrets** (not variables) on the GitHub repo. `SUPABASE_DB_PASSWORD`, `PRODUCTION_SITE_URL`, and `PRODUCTION_ADDITIONAL_REDIRECT_URL` are not used and can be removed if they are still set.

| Secret | Purpose |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from the [Supabase account tokens](https://supabase.com/dashboard/account/tokens) page |
| `SUPABASE_PROJECT_ID` | Hosted project ref passed to `config push --project-ref` |
| `RESEND_API_KEY` | Resend sending API key interpolated as hosted Auth SMTP password |

Local CLI needs the `RESEND_API_KEY` placeholder in `.env.local` (copy from `.env.example`) so remotes SMTP config can load. Keep the real Resend key only in GitHub secrets.
