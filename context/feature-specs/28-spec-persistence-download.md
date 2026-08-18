# 28 Spec Persistence and Download

**Status:** Complete

Expose Edge Function-generated specs through project-scoped metadata APIs and a secure download route.

### Implementation

1. Project spec metadata

Use the `project_specs` table created by the spec generation flow:

- `id` (uuid, primary key)
- `task_run_id` (uuid, unique foreign key to `task_runs`)
- `project_id` (uuid, foreign key to `projects`)
- `file_path` (storage path)
- `created_at` (timestamp)

Enable RLS with project-member access policies through the `projects` table. Use this table for metadata only. The actual spec content should live in Supabase Storage.

Add an index on `project_id`. Grant only the privileges required by the authenticated read path, and keep insert, update, and delete access restricted to the privileged worker path.

2. List generated specs

Create a project-scoped endpoint that:
- authenticates the user
- verifies project access
- lists spec IDs and creation metadata without exposing storage paths
- returns newest specs first

3. Download route

Create a route like: `GET /api/projects/[projectId]/specs/[specId]/download`

It should:

- authenticate the user
- verify access to the project
- verify the spec belongs to that project
- fetch the file using the storage path from `project_specs.file_path`
- return it as a downloadable Markdown file
- handle not found and forbidden cases properly

### Scope Limits

- do not add frontend or UI logic
- do not store spec content in the Supabase table
- do not expose storage paths without access checks
- do not modify existing canvas persistence
- do not regenerate or duplicate artifacts already persisted by the Edge Function

### Notes

- check `context/project-overview.md` and `context/architecture-context.md` first
- reuse existing project access patterns
- Supabase tables store metadata, Supabase Storage stores content

### Check When Done

- `project_specs` table exists with required fields
- generated spec metadata can be listed by authorized project members
- download route validates access before returning file
- response is a Markdown attachment
- TypeScript and build pass
