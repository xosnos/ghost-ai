Persist generated specs with Supabase Storage and the Supabase database, then add a secure download route so users can retrieve their generated spec files.

### Implementation

1. project_specs table

Ensure a `project_specs` Supabase table exists with:

- `id` (uuid, primary key)
- `projectId` (uuid, foreign key to `projects`)
- `filePath` (storage path)
- `createdAt` (timestamp)

Enable RLS with owner-scoped policies through the `projects` table. Use this table for metadata only. The actual spec content should live in Supabase Storage.

2. Save generated spec

After a spec is generated:

- upload the Markdown content to a Supabase Storage bucket
- store the storage path in `project_specs.filePath`
- link the record to the correct project
- follow the same metadata + storage pattern used for canvas persistence

3. Download route

Create a route like: `GET /api/projects/[projectId]/specs/[specId]/download`

It should:

- authenticate the user
- verify access to the project
- verify the spec belongs to that project
- fetch the file using the storage path from `project_specs.filePath`
- return it as a downloadable Markdown file
- handle not found and forbidden cases properly

### Scope Limits

- do not add frontend or UI logic
- do not store spec content in the Supabase table
- do not expose storage paths without access checks
- do not modify existing canvas persistence

### Notes

- check `context/project-overview.md` and `context/architecture-context.md` first
- reuse existing project access patterns
- Supabase tables store metadata, Supabase Storage stores content

### Check When Done

- `project_specs` table exists with required fields
- spec is uploaded to Supabase Storage
- `filePath` is saved correctly
- download route validates access before returning file
- response is a Markdown attachment
- TypeScript and build pass
