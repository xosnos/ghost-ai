# Supabase Schema And Data Layer

## Goal

Add the project data models as Supabase tables with Row Level Security, using Bolt's integrated Supabase database. No Prisma — the schema is applied via the Supabase migration tool and accessed through the existing Supabase client.

## Tables

Create a Supabase migration that adds the following tables.

### projects

- `id` (uuid, primary key, `DEFAULT gen_random_uuid()`)
- `owner_id` (uuid, not null, `DEFAULT auth.uid()`, references `auth.users(id)` with `ON DELETE CASCADE`)
- `name` (text, not null)
- `description` (text, nullable)
- `status` (text, not null, default `'DRAFT'`) — values: `'DRAFT'`, `'ARCHIVED'`
- `canvas_storage_path` (text, nullable) — reference to the canvas JSON in Supabase Storage
- `created_at` (timestamptz, default `now()`)
- `updated_at` (timestamptz, default `now()`)

Indexes:

- index on `owner_id`
- index on `created_at`

### project_collaborators

- `id` (uuid, primary key, `DEFAULT gen_random_uuid()`)
- `project_id` (uuid, not null, references `projects(id)` with `ON DELETE CASCADE`)
- `email` (text, not null)
- `created_at` (timestamptz, default `now()`)

Constraints:

- unique constraint on `(project_id, email)`

Indexes:

- index on `email`
- compound index on `(project_id, created_at)`

## Row Level Security

Enable RLS on both tables. The app has a sign-in screen, so policies are scoped to `TO authenticated`.

### projects

Owner-scoped CRUD — each authenticated user can only access rows they own.

- SELECT: `USING (auth.uid() = owner_id)`
- INSERT: `WITH CHECK (auth.uid() = owner_id)`
- UPDATE: `USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)`
- DELETE: `USING (auth.uid() = owner_id)`

The `DEFAULT auth.uid()` on `owner_id` ensures inserts that omit the owner still satisfy the INSERT policy.

### project_collaborators

Access is granted through ownership of the parent project.

- SELECT: `USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_collaborators.project_id AND projects.owner_id = auth.uid()))`
- INSERT: `WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_collaborators.project_id AND projects.owner_id = auth.uid()))`
- UPDATE: `USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_collaborators.project_id AND projects.owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_collaborators.project_id AND projects.owner_id = auth.uid()))`
- DELETE: `USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_collaborators.project_id AND projects.owner_id = auth.uid()))`

## Supabase Client

The Supabase client is already set up in `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server). Use these existing singletons for all database access — do not create a separate database client.

## Migration

Apply the schema using the Supabase `apply_migration` MCP tool. Do not write SQL files to disk — the migration is applied directly through the tool. Each migration must start with a detailed markdown summary in multi-line comments explaining all new tables, columns, indexes, and security changes.

Use `IF NOT EXISTS` for idempotent table and index creation. For policies, drop first then create to ensure idempotency.

## Check When Done

- `projects` table exists with correct columns, indexes, and RLS policies
- `project_collaborators` table exists with correct columns, constraints, indexes, and RLS policies
- `owner_id` defaults to `auth.uid()` so inserts without an explicit owner succeed
- `lib/supabase/client.ts` and `lib/supabase/server.ts` are used for all database access
- migration is applied successfully via the Supabase migration tool
- `npm run build` passes
