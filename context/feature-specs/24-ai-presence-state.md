Add shared AI activity indicators so everyone in the room can see when generation is in progress. This unit is only for UI, presence, and realtime status signals. Do not add the actual AI generation flow yet.

## Implementation

1. Add AI thinking state to the sidebar.
   - show a small status indicator when AI is working
   - make the status visible to everyone in the room
   - disable the chat input while generation is active
   - show a loading state on the send button
   - keep the rest of the sidebar usable

2. Add a shared AI status feed.
   - check the existing Supabase Realtime setup and installed agent-related features first
   - follow Realtime best practices for broadcast/presence instead of creating parallel realtime state
   - create or reuse a Realtime Broadcast channel named `ai-status` on the project channel
   - subscribe to the latest broadcast message in the sidebar
   - show only the most recent status message
   - keep the broadcast generic enough for design and spec generation later

3. Add status message validation.
   - define the feed payload schema in `types/tasks.ts`
   - the payload should support an optional `text` field
   - validate incoming messages before displaying them

4. Add thinking indicators to live cursors.
   - when a participant has `thinking: true` in presence, show a small spinner in their cursor name badge
   - hide the spinner when `thinking` is false or missing

## Scope Limits

- don’t add actual AI generation logic
- don’t trigger background tasks yet
- don’t block or dim the whole sidebar
- don’t show full feed history
- keep this focused on shared AI activity state only

## Check When Done

- Sidebar can render shared AI status from the `ai-status` broadcast channel.
- Chat input and send button respond to active generation state.
- Cursor badges read `thinking` from presence.
- Feed messages are validated through the task schema.
- `npm run build` passes.
