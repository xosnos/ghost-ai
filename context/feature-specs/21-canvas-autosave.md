Add autosave and loading for the collaborative canvas so project state is persisted before adding AI generation Canvas JSON should be stored in Supabase Storage, and the saved storage path should be stored on the Supabase project record.

## What to Install

- No new packages needed. Supabase Storage is accessed through the existing `@supabase/supabase-js` client.

## Implementation

1. Check the existing project schema.
   - review the `projects` table in the Supabase schema
   - add or reuse a field for the canvas storage path
   - keep the Supabase table responsible for metadata only

2. Add canvas save/load API routes.
   Create: `PUT /api/projects/[projectId]/canvas`
   This route should:
   - receive the latest canvas JSON
   - upload the JSON to a Supabase Storage bucket
   - store the returned storage path on the matching Supabase project record

   Create: `GET /api/projects/[projectId]/canvas`
   This route should:
   - read the project's saved storage path from the Supabase `projects` table
   - fetch the saved canvas JSON from Supabase Storage
   - return the canvas state to the editor

3. Add an autosave hook in the `/hook` folder.
   - watch the canvas nodes and edges
   - debounce saves to avoid excessive writes
   - save through the canvas API route
   - track save status: saving, saved, error

4. Load saved canvas state in the editor.
   - when the editor loads, check if the Liveblocks room has any existing nodes or edges
   - if the room is empty and the project has a saved canvas storage path, fetch and load the saved canvas state
   - if the room already has nodes or edges, skip the load entirely to avoid overwriting active collaboration

5. Add a small save status indicator in the editor Save button.
   - show saving, saved, or error states

## Storage Pattern

- The Supabase `projects` table stores project metadata and the canvas storage path.
- Supabase Storage stores the actual canvas JSON.

## Check When Done

- Supabase Storage bucket is configured for canvas JSON.
- Project table supports storing the canvas storage path.
- Save/load routes use Supabase for metadata and Supabase Storage for canvas JSON.
- Autosave hook debounces canvas saves.
- Editor shows save status.
- Saved canvas does not load if the room already has
  active nodes or edges
- `npm run build` passes.
