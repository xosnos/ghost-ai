/*
# Fix shared-projects access: RLS policies + query compatibility

## Problem
1. The `select_own_project_collaborators` policy only allowed project OWNERS to
   read collaborator rows. An invited collaborator could never read their own
   rows, so "shared projects" always returned empty for them.
2. The `select_own_projects` policy only allowed owners to read project rows.
   A collaborator querying for a project they collaborate on (but don't own)
   was blocked by RLS.

## Fix
- `projects` SELECT: allow owner OR any authenticated user who is a
  collaborator (matched by email via the JWT) on that project.
- `project_collaborators` SELECT: allow the project owner OR the collaborator
  themselves (matched by email via the JWT).
- Mutations (INSERT/UPDATE/DELETE) on both tables remain owner-only, which is
  correct — only the owner can manage their project and its collaborator list.

The email match uses `auth.jwt() ->> 'email'`, the standard Supabase pattern
for resolving the signed-in user's email inside RLS.
*/

-- ---------------------------------------------------------------------------
-- projects: broaden SELECT to include collaborators
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM project_collaborators c
      WHERE c.project_id = projects.id
        AND c.email = (auth.jwt() ->> 'email')
    )
  );

-- ---------------------------------------------------------------------------
-- project_collaborators: broaden SELECT to include the collaborator themselves
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_project_collaborators" ON project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON project_collaborators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_collaborators.project_id
        AND p.owner_id = auth.uid()
    )
    OR project_collaborators.email = (auth.jwt() ->> 'email')
  );
