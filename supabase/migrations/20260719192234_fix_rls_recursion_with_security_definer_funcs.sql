/*
# Fix infinite recursion in projects / project_collaborators RLS policies

## Problem
The previous migration broadened SELECT policies so that:
  - `projects` SELECT subqueries `project_collaborators`
  - `project_collaborators` SELECT subqueries `projects`
Both tables have RLS enabled, so evaluating either policy triggers
evaluation of the other, which triggers the first again →
`infinite recursion detected in policy for relation "projects"`.

The same recursion also affects the `project_collaborators`
INSERT/UPDATE/DELETE policies, which subquery `projects`.

## Fix
Replace all cross-table subqueries in RLS policies with two
`SECURITY DEFINER` helper functions. Because SECURITY DEFINER
functions execute as their owner (a role that bypasses RLS),
the inner queries do not re-enter policy evaluation, breaking
the cycle.

Functions:
  - is_project_owner(uuid)  → true if auth.uid() owns the project
  - is_project_collaborator(uuid) → true if the caller's JWT email
    appears in project_collaborators for that project

All policies are dropped and recreated. Mutations remain owner-only.
*/

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER → bypass RLS, no recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_owner(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid
      AND p.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_collaborator(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaborators c
    WHERE c.project_id = project_uuid
      AND c.email = (auth.jwt() ->> 'email')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_collaborator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_collaborator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- projects policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_project_collaborator(id)
  );

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
-- project_collaborators policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_project_collaborators" ON project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON project_collaborators FOR SELECT
  TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR project_collaborators.email = (auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "insert_own_project_collaborators" ON project_collaborators;
CREATE POLICY "insert_own_project_collaborators"
  ON project_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "update_own_project_collaborators" ON project_collaborators;
CREATE POLICY "update_own_project_collaborators"
  ON project_collaborators FOR UPDATE
  TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (public.is_project_owner(project_id));

DROP POLICY IF EXISTS "delete_own_project_collaborators" ON project_collaborators;
CREATE POLICY "delete_own_project_collaborators"
  ON project_collaborators FOR DELETE
  TO authenticated
  USING (public.is_project_owner(project_id));
