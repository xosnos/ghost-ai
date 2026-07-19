/*
# Create projects and project_collaborators tables

## Summary

This migration introduces the core project data model for Ghost AI, backed by
Bolt's integrated Supabase (PostgreSQL) database. It adds two tables that store
project metadata and collaborator invitations, plus owner-scoped Row Level
Security so each authenticated user can only access projects they own (and, by
extension, the collaborators attached to those projects).

This is a multi-user app with a sign-in screen (Supabase Auth email/password,
implemented in feature 03). All policies are scoped to `TO authenticated` and
use `auth.uid()` for ownership checks. The frontend uses the anon-key Supabase
client, but every meaningful request is made after sign-in, so the
`authenticated` scope is correct.

## 1. New Tables

### projects
Stores one row per project owned by a Supabase Auth user.

- `id` (uuid, primary key) — unique project identifier, auto-generated.
- `owner_id` (uuid, not null) — the Supabase Auth user who owns the project.
  Defaults to `auth.uid()` so client inserts that omit the owner still satisfy
  the INSERT row-level security check.
  References `auth.users(id)` with `ON DELETE CASCADE`, so deleting a user
  removes their projects.
- `name` (text, not null) — display name of the project.
- `description` (text, nullable) — optional free-form description.
- `status` (text, not null, default `'DRAFT'`) — project lifecycle state.
  Allowed values: `'DRAFT'`, `'ARCHIVED'` (enforced via CHECK constraint).
- `canvas_storage_path` (text, nullable) — reference to the canvas JSON blob
  stored in Supabase Storage (e.g. `canvas/{projectId}.json`).
- `created_at` (timestamptz, default `now()`) — creation timestamp.
- `updated_at` (timestamptz, default `now()`) — last-modified timestamp.

Indexes:
- `projects_owner_id_idx` on `owner_id` — speeds up "list my projects" queries.
- `projects_created_at_idx` on `created_at` — speeds up ordering by recency.

### project_collaborators
Stores one row per invited collaborator on a project. Collaborators are
identified by email (matching the auth model where users sign in by email).

- `id` (uuid, primary key) — unique row identifier, auto-generated.
- `project_id` (uuid, not null) — the project this collaborator belongs to.
  References `projects(id)` with `ON DELETE CASCADE`, so deleting a project
  removes its collaborators.
- `email` (text, not null) — the collaborator's email address.
- `created_at` (timestamptz, default `now()`) — when the invitation was added.

Constraints:
- Unique constraint on `(project_id, email)` — prevents duplicate invitations.

Indexes:
- `project_collaborators_email_idx` on `email` — speeds up lookup by email
  (used when resolving which projects a user collaborates on).
- `project_collaborators_project_id_created_at_idx` on `(project_id, created_at)`
  — speeds up listing collaborators for a project ordered by join date.

## 2. Security (Row Level Security)

RLS is enabled on both tables. Because the app has a sign-in screen, all
policies are scoped to `TO authenticated` and use `auth.uid()` for ownership
checks.

### projects
Owner-scoped CRUD. Each authenticated user can only access rows they own.

- SELECT  — `USING (auth.uid() = owner_id)`
- INSERT  — `WITH CHECK (auth.uid() = owner_id)`
- UPDATE  — `USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id)`
- DELETE  — `USING (auth.uid() = owner_id)`

The `DEFAULT auth.uid()` on `owner_id` ensures that inserts made without an
explicit owner (the normal client pattern) still satisfy the INSERT policy.

### project_collaborators
Access is granted through ownership of the parent project. A user can only
read/modify collaborators for projects they own.

- SELECT  — granted if the parent project is owned by the caller
- INSERT  — allowed if the parent project is owned by the caller
- UPDATE  — allowed if the parent project is owned by the caller
- DELETE  — allowed if the parent project is owned by the caller

The ownership predicate is:
  EXISTS (SELECT 1 FROM projects
          WHERE projects.id = project_collaborators.project_id
            AND projects.owner_id = auth.uid())

## 3. Important Notes

1. Idempotency: tables and indexes use `IF NOT EXISTS`. Policies are dropped
   first then recreated so re-running this migration is safe (useful because
   `apply_migration` can time out after the SQL has committed server-side).
2. No data is lost by re-running — `DROP POLICY IF EXISTS` only removes
   policy definitions, never table data.
3. The Supabase client singletons in `lib/supabase/client.ts` (browser) and
   `lib/supabase/server.ts` (server) are used for all database access; this
   migration does not add a new client.
4. `owner_id` is intentionally `NOT NULL DEFAULT auth.uid()` rather than
   relying on the frontend to thread the owner through every insert.
5. Canvas content itself is NOT stored in this table — only the Storage path
   reference (`canvas_storage_path`). The JSON blob lives in Supabase Storage.
*/

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ARCHIVED')),
  canvas_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects (created_at);

DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_projects" ON projects;
CREATE POLICY "insert_own_projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_projects" ON projects;
CREATE POLICY "update_own_projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_projects" ON projects;
CREATE POLICY "delete_own_projects"
  ON projects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- project_collaborators
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_collaborators_project_id_email_key UNIQUE (project_id, email)
);

ALTER TABLE project_collaborators ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS project_collaborators_email_idx ON project_collaborators (email);
CREATE INDEX IF NOT EXISTS project_collaborators_project_id_created_at_idx ON project_collaborators (project_id, created_at);

DROP POLICY IF EXISTS "select_own_project_collaborators" ON project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON project_collaborators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_project_collaborators" ON project_collaborators;
CREATE POLICY "insert_own_project_collaborators"
  ON project_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_project_collaborators" ON project_collaborators;
CREATE POLICY "update_own_project_collaborators"
  ON project_collaborators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_project_collaborators" ON project_collaborators;
CREATE POLICY "delete_own_project_collaborators"
  ON project_collaborators FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_collaborators.project_id
        AND projects.owner_id = auth.uid()
    )
  );
