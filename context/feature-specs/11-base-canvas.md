Replace the canvas placeholder with a Supabase Realtime-backed React Flow canvas.

## Implementation

1. Keep the workspace page server-side.

2. Create a client-side editor/canvas wrapper that sets up the Realtime channel.

   It should include:
   - the Supabase Realtime channel scoped to the current room ID (project ID)
   - Presence enabled with initial state `cursor: null`
   - Broadcast enabled for canvas sync events
   - a loading state while the channel connects
   - an error fallback for Realtime connection issues

3. Wire React Flow to Realtime state.
   - create a custom hook (e.g. `useRealtimeFlow`) that syncs nodes and edges via Realtime Broadcast
   - broadcast node/edge changes to all subscribers on the channel
   - apply incoming broadcast events to local React Flow state
   - start with empty nodes and edges
   - pass the synced nodes, edges, and change handlers into `ReactFlow`

4. Add shared canvas types in `types/canvas.ts`.

   Node data should support:
   - label
   - color
   - shape

   Also define the custom node and edge types:
   - `canvasNode`
   - `canvasEdge`

5. Render the basic canvas.

   Include:
   - loose connection behavior
   - `fitView`
   - `MiniMap`
   - dot-pattern background

## Scope Limits

- don't add controls yet
- don't add custom node or edge rendering yet
- don't add persistence logic
- don't add AI behavior
- keep this focused on the collaborative canvas foundation

## Check When Done

- Client canvas wrapper sets up the Supabase Realtime channel.
- React Flow uses Realtime-synced nodes and edges via a custom hook.
- Shared canvas types exist in `types/canvas.ts`.
- `npm run build` passes.
