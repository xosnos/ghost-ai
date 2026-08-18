# Supabase backend review

**Date:** 2026-08-17  
**Scope:** Postgres migrations, RLS, grants, Storage, Realtime, Queues/Cron, Next.js clients, Edge Functions, and the `ai-worker`  
**References:** `.agents/skills/supabase/SKILL.md`, `.agents/skills/supabase-postgres-best-practices/`, [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth.md), [Exposing a table to the Data API](https://supabase.com/docs/guides/api/securing-your-api.md)

**Document status:** Point in time review. For current implementation status and remaining acceptance gaps, see `context/progress-tracker.md`.

## Verdict

The local Ghost AI stack is mostly set up correctly. Public app tables have RLS. Policies use `TO authenticated` with ownership or membership predicates, not deprecated `auth.role()`. UPDATE policies include `WITH CHECK`. Browser clients only receive the anon key. Middleware uses `@supabase/ssr` and `getUser()`. `verify_jwt = false` on `ai-worker` matches the documented pattern for named secret (service-to-service) calls.

It was not production-safe as reviewed. Owner RPCs trusted a client-supplied `owner_uuid`. Local seed re-granted `EXECUTE` on sensitive functions. A vault automation secret was committed in a migration. The custom `ai-worker` auth wrapper failed open when no expected secret resolved. Cron targeted a local Docker hostname.

This change set remediates the critical and high items. Remaining medium/low items are listed at the end.

## Skill checklist

| Check | Status after review |
|-------|---------------------|
| RLS on public app tables | Pass |
| Policies use `TO` plus an ownership predicate | Pass |
| UPDATE has `USING` and `WITH CHECK` | Pass |
| No `user_metadata` in authorization | Pass (display only in `get_project_collaborators`) |
| `service_role` not in `NEXT_PUBLIC_*` | Pass |
| SECURITY DEFINER authorizes with `auth.uid()` | Fail on delete/add/remove (fixed) |
| REVOKE EXECUTE from `PUBLIC`/`anon` on DEFINER | Fail on `delete_project`; seed undid others locally (fixed) |
| Views use `security_invoker` | N/A (no views) |
| Storage upsert needs INSERT + SELECT + UPDATE | Pass for `canvas` |
| Edge Function named secret, fail closed | Fail (fixed) |
| Pin / lock Supabase packages | Partial (lockfile pins; `package.json` now exact) |

Recent changelog notes that apply: tables are not auto-exposed to the Data API (2026-04-28). Local CLI does not apply hosted default GRANTs, which is why `seed.sql` exists. That seed must not undo function EXECUTE lockdowns.

---

## Critical

### 1. BOLA on owner SECURITY DEFINER RPCs

`delete_project(uuid, uuid)`, `add_project_collaborator(uuid, text, uuid)`, and `remove_project_collaborator(uuid, text, uuid)` were granted to `authenticated` and authorized with a caller-supplied `owner_uuid`. Collaborators can read `owner_id` from `get_project_collaborators` (which already uses `auth.uid()` successfully). A direct PostgREST RPC call could delete the project or manage invites. Next.js route checks do not protect that path.

**Fix:** Recreate the functions without `owner_uuid`. Authorize with `auth.uid()`. Use `SET search_path = public, auth` like `get_project_collaborators`. App callers no longer send `owner_uuid`.

### 2. `delete_project` EXECUTE left on PUBLIC

The final `delete_project` migration granted `authenticated` but never revoked `PUBLIC`/`anon`. New functions default to `EXECUTE` for `PUBLIC`.

**Fix:** `REVOKE` from `PUBLIC` and `anon` in the new migration and again in `seed.sql`.

### 3. `seed.sql` re-granted ALL functions

The local GRANT bootstrap restored `EXECUTE` on `get_vault_secret`, `enqueue_task_run`, `get_cron_job`, and `pgmq_public.*` to `anon`/`authenticated`. Those helpers have no caller check in the function body.

**Fix:** Blanket function grants no longer include `anon`. After bootstrap, seed re-applies the migration REVOKEs and sets the local vault automation secret.

---

## High

### 4. Hardcoded vault automation secret

`20260817000000_create_task_runs_and_queue.sql` originally inserted a committed Vault placeholder and used it as Cron `apikey`/`Authorization`. Combined with `verify_jwt = false`, anyone who knows that value could invoke the worker.

**Fix:** Later migrations no longer invent hosted secrets. Local `seed.sql` sets `local-dev-automation-secret` (must match `.env.example`). Hosted projects must set a unique Vault `automations` secret and the same value as the Edge Function `AUTOMATION_SECRET`. The leaked placeholder remains in git history and must be treated as compromised.

### 5. `ai-worker` fail-open auth

The custom `withSupabase` wrapper rejected a mismatch only when `expectedSecret` was truthy. If no named key, `AUTOMATION_SECRET`, or service role was configured, any non-empty `apikey`/Bearer passed. Official `@supabase/server` `auth: "secret:automations"` is fail-closed.

**Fix:** Resolve the named automations key from `SUPABASE_SECRET_KEYS` or `AUTOMATION_SECRET` only (no service-role fallback). Return 401 when the expected secret is missing or the header does not match.

### 6. Cron worker URL is local Docker only

`pg_cron` posted to `http://supabase_kong_ghost-ai:8000/functions/v1/ai-worker`. That hostname exists only on the local CLI network. A hosted project would not recover queued jobs until Cron is pointed at the project Functions URL.

**Fix:** Store `ai_worker_url` in Vault and read it from the Cron command. Local seed sets the Kong URL. Hosted operators must set Vault `ai_worker_url` to `https://<project-ref>.supabase.co/functions/v1/ai-worker`.

---

## Edge Functions and AI worker

### What is correct

- Single worker at `supabase/functions/ai-worker/index.ts` with shared handlers in `_shared/`.
- `verify_jwt = false` is required for secret-key callers (Cron, Next.js fast path). The handler must authenticate.
- Queue read uses a 300s visibility timeout above the 120s application deadline.
- `EdgeRuntime.waitUntil` returns 202 and lets Cron recover missed work.
- Spec handler checks `task_runs` kind and `project_id` before writing Storage.
- Specs bucket writes go through service role; members only SELECT.
- OpenRouter is the only model gateway; missing `OPENROUTER_API_KEY` is a permanent error.
- `enqueue_task_run` is SECURITY INVOKER and EXECUTE is intended for `service_role` only.

### Additional worker findings (this review)

| Severity | Finding | Action |
|----------|---------|--------|
| High | Fail-open named-secret check | Fixed in `ai-worker/index.ts` |
| High | Fast path sent `SUPABASE_SERVICE_ROLE_KEY` when `AUTOMATION_SECRET` was unset | Fast path now requires `AUTOMATION_SECRET` |
| Medium | Queue payload `kind`/`project_id` trusted over `task_runs` | Worker now uses the `task_runs` row as source of truth |
| Medium | Design handler did not verify run kind/project (spec handler did) | `processDesignTask` now matches the spec check |
| Medium | Worker logged the full user prompt | Log line no longer includes prompt text |
| Low | Duplicate `getOpenRouterApiKey` with `Deno.readTextFileSync` fallback | Local-only; leave unless a later cleanup |
| Low | `deno.json` pins `@supabase/supabase-js@2.48.0` while the app uses 2.110.0 | Documented; not bumped here |
| Low | CORS `Access-Control-Allow-Origin: *` | Acceptable for a secret-gated worker; not a browser API |
| Info | Custom `withSupabase` instead of `npm:@supabase/server` | Compatible if fail-closed; migrating to the official helper is optional later |

---

## Medium / low (not all fixed)

| Severity | Issue | Notes |
|----------|-------|--------|
| Medium | Older project RLS policies call `auth.uid()` bare, not `(select auth.uid())` | Performance; `task_runs` / `project_specs` already wrap |
| Medium | Canvas bucket lets collaborators write and delete | Intended for collab editing |
| Low | Four historical `*.sql.sql` migration filenames | Leave applied history alone |
| Low | PII email in old collaborator fix migrations | Historical; no new PII |
| Info | Realtime publication of `task_runs` / `project_specs` | RLS filters subscriber rows |

---

## What was already correct (do not regress)

- RLS on `projects`, `project_collaborators`, `task_runs`, `project_specs`; queue tables have RLS with no client policies.
- `is_project_owner` / `is_project_collaborator` are SECURITY INVOKER.
- Private `canvas` and `specs` buckets; Realtime broadcast topics member-gated.
- `lib/supabase/client.ts` anon only; `admin.ts` service role, server-only.
- `middleware.ts` cookie SSR + `getUser()`.

---

## Hosted follow-up (operators)

After pushing this migration to a hosted project:

1. Set Vault secret `automations` to a unique value (not anything from git).
2. Set Edge Function secret `AUTOMATION_SECRET` to the same value.
3. Set Vault secret `ai_worker_url` to `https://<project-ref>.supabase.co/functions/v1/ai-worker`.
4. Confirm Cron `ai-worker-recovery` is active and returns 202, not 401.
5. Confirm `OPENROUTER_API_KEY` is set as an Edge Function secret.
