# 26 Functional AI Chat

**Status:** Complete

Wire up the AI sidebar so users can submit design prompts, track Edge Function run status in real time, and reflect AI-driven canvas updates through Supabase Realtime.

### Implementation

1. Submit from the AI sidebar

- On submit:
  - push the user message to the `ai-chat` Broadcast channel
  - call `POST /api/ai/design` with `{ prompt, roomId }`
  - read `{ runId }` from the HTTP 202 response
- store only `runId` in local state; no provider run token is needed

2. Run status tracking

- Subscribe to Realtime Postgres Changes for the authorized `task_runs` row, filtered by `id = runId`.
- Treat `queued`, `running`, and `retrying` as active states.
- While active:
  - disable the chat input
  - show a loading spinner in the send button
- When the run completes:
  - reset loading and local run state
  - render the final AI message emitted once by the worker on `ai-chat`, keyed by the run ID
- When the run fails:
  - reset loading and local run state
  - render the sanitized row error locally if the worker error broadcast was missed
- Let the worker publish shared completion or failure chat messages with stable IDs. Clients must not rebroadcast terminal messages from Realtime row updates.
- Fetch the run once when subscribing so a missed Realtime event cannot leave the UI stuck.

3. Canvas updates

- Do not manually update nodes or edges.
- Rely on the Supabase Realtime canvas sync hook to apply Broadcast events emitted by the AI worker.

4. Shared status display

- Read the latest message from the project-scoped `ai-status` Broadcast channel.
- Show a compact status strip above the input only while the current run is active.

### UI Details

- Use existing design tokens; do not introduce raw colors.
- Follow `ui-context.md` and keep the current sidebar layout intact.
- Show failures as messages in the existing `ai-chat` feed.

### Scope Limits

- Do not implement backend or Edge Function logic in this unit.
- Do not fetch final graph data.
- Do not redesign the sidebar.
- Do not manually sync canvas state.
- Do not add a token endpoint or third-party run-status hook.

### Check When Done

- Submitting a prompt calls `/api/ai/design` and receives a `runId`.
- The client tracks the authorized `task_runs` row through Postgres Changes.
- Input is disabled only while the run is queued, running, or retrying.
- Status and chat updates appear across multiple sessions.
- Completion and failure both clear active UI state.
- Multiple tabs do not duplicate terminal AI chat messages.
- No TypeScript or build errors.
