# 23 Design Agent Logic

**Status:** Complete

Implement the full AI design agent so a user prompt results in real-time updates on the collaborative canvas, with visible AI presence and status.

## Implementation

1. Add the design handler in `supabase/functions/_shared/design-agent.ts` and dispatch to it from `supabase/functions/ai-worker/index.ts`.

   Before implementing:
   - check `context/project-overview.md` and `context/architecture-context.md` for product behavior and system rules
   - check current Supabase Edge Functions and Realtime guidance for background execution and canvas mutation
   - reuse existing Supabase Realtime Broadcast patterns instead of creating a parallel state system

   Then implement:
   - use OpenRouter's OpenAI-compatible HTTP API to interpret the user prompt
   - prefer `openrouter/free`; explicit fallback models must use free OpenRouter variants
   - update the canvas through the existing collaborative event contract
   - support actions like:
     - add node
     - move node
     - resize node
     - update node data
     - delete node
     - add edge
     - delete edge
   - publish AI activity to the project-scoped `ai-status` Broadcast channel so all users see progress
   - publish AI cursor and thinking state while generation runs
   - send clear status messages at key steps: start, processing, complete, and failed
   - let the queue worker own `task_runs` lifecycle and retry state
   - ensure generated designs follow the allowed node shapes, color palette, layout, and spacing rules
   - clear AI activity state when the function completes or fails
   - classify provider and network errors as transient or permanent so the queue worker can retry correctly
   - use the task-run ID as the operation ID and derive stable IDs for generated nodes and edges
   - express moves, resizes, updates, and deletes as absolute idempotent operations so replaying a message cannot duplicate or drift canvas state

## Configuration

- Store `OPENROUTER_API_KEY` as a Supabase Edge Function secret; `.env.local` is only for local Next.js development.
- Call OpenRouter at `https://openrouter.ai/api/v1`. Prefer `openrouter/free`; explicit fallbacks must be free OpenRouter models. Do not use a paid model, a Google AI SDK client, or `GOOGLE_AI_API_KEY`.
- Keep named secret keys and provider secrets out of browser code and API responses.

## Scope Limits

- don’t change canvas architecture
- don’t introduce a new state system outside Supabase Realtime, Supabase Queues, and `task_runs`
- don’t bypass the existing collaborative canvas event schema
- don’t add multi-step orchestration that can exceed Edge Function execution limits
- don’t add a Google AI, Anthropic, or OpenAI client alongside OpenRouter

## Check When Done

- The queue worker design handler updates the canvas through the existing collaborative event contract.
- AI presence and status are visible to all participants.
- The task run reaches `completed` or `failed` on every handled path.
- Errors do not leave AI presence or the run in an active state.
- Reprocessing the same task-run ID does not duplicate canvas mutations.
- `supabase functions serve ai-worker` works locally.
- `npm run build` passes.
