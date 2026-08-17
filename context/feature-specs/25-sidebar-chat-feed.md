Add real-time room chat to the AI sidebar using a separate Supabase Realtime Broadcast channel for `ai-chat`.

This is only for chat messages. Keep it separate from the `ai-status` broadcast channel, which handles AI progress and presence updates.

## Implementation

1. Add the `ai-chat` broadcast channel.

   Before implementing, check the existing Supabase Realtime setup and follow the same broadcast patterns already used in the project.
   - create or reuse a Realtime Broadcast channel named `ai-chat` on the project channel
   - keep it room-scoped
   - do not mix it with the `ai-status` broadcast channel

2. Wire the chat broadcast into the sidebar.
   - subscribe to `ai-chat` broadcast events in the sidebar chat area
   - render chat messages in order
   - show sender, timestamp, and message content
   - keep the styling consistent with the existing sidebar UI
   - use Tailwind utilities and existing shadcn components where they fit

3. Add message sending.
   - allow users in the room to send messages to `ai-chat`
   - use the existing sidebar input and send button
   - clear the input after a successful send
   - show a small error state if sending fails

4. Add message validation.
   - define or reuse a Zod schema in `types/tasks.ts`
   - message shape should include a stable message ID, sender, role, content, and timestamp, plus an optional run ID
   - validate broadcast messages before rendering them
   - ignore a repeated stable message ID

## Scope Limits

- don't add AI-generated replies yet
- don't trigger backend AI tasks
- don't mix chat messages with status messages
- don't create a parallel realtime system outside Supabase Realtime
- keep this focused on collaborative sidebar chat only

## Check When Done

- Sidebar subscribes to the `ai-chat` broadcast channel.
- Users can send chat messages through the existing sidebar input.
- Chat messages are validated before rendering.
- `ai-chat` remains separate from `ai-status`.
- `npm run build` passes.
