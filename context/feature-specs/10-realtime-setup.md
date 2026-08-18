# 10 Realtime Setup

**Status:** Complete

Set up the realtime collaboration infrastructure using Supabase Realtime.

## Configuration

Supabase Realtime is already available in the provisioned Supabase instance. No external service or separate API keys are needed.

Define a shared presence type in `types/realtime.ts`.

### Presence

- `cursor`: `{ x: number; y: number } | null`
- `thinking`: boolean

### UserMeta

- user ID
- display name
- avatar URL
- cursor color

## Realtime Client

Create a cached Supabase Realtime channel helper in `lib`.

The helper should:
- create a Realtime channel scoped to the project ID (used as the room/room ID equivalent)
- enable Presence and Broadcast on the channel
- provide a deterministic color assignment helper that maps a user ID to a consistent color from the fixed `NODE_COLORS` palette

## Auth / Access Control

Realtime channel access is gated by the existing Supabase Auth session.

No separate auth route is needed. Instead:
1. The client joins the channel using the authenticated Supabase client
2. The server-side editor page already verifies project access using the existing `hasProjectAccess` helper before rendering the editor
3. RLS policies on the `projects` table ensure only authorized users can read project data
4. Presence and Broadcast events are scoped to users who have joined the channel

## Dependencies

No new packages needed. Supabase Realtime is accessed through the existing `@supabase/supabase-js` client.

## Check When Done

- `types/realtime.ts` defines Presence and UserMeta types
- Realtime channel helper creates a project-scoped channel with Presence and Broadcast enabled
- Channel access is gated by existing Supabase Auth and `hasProjectAccess`
- User metadata (name, avatar, cursor color) is attached to presence
- `npm run build` passes
