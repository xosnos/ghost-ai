/*
# Optimize RLS Policy Initplans and Function Search Paths

## Summary
1. Fixes `auth_rls_initplan` warnings reported by Supabase DB Advisors:
   - Wraps `auth.uid()` and `auth.jwt()` in subselects `(SELECT auth.uid())` and `(SELECT auth.jwt())` on `projects` and `project_collaborators` RLS policies. This ensures PostgreSQL evaluates authentication lookups once per statement (initPlan) rather than re-evaluating per row.
2. Fixes `function_search_path_mutable` security warnings:
   - Adds `SET search_path = public` to `public.canvas_project_id`, `public.specs_project_id`, and `public.project_id_from_realtime_topic`.
*/

-- ---------------------------------------------------------------------------
-- 1. Helper functions: set explicit search_path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canvas_project_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$') IS NOT NULL
      THEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$')::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.specs_project_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.md$') IS NOT NULL
      THEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.md$')::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.project_id_from_realtime_topic(topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN topic ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN substring(topic FROM 9)::uuid
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- 2. projects RLS policies: optimize with (SELECT auth.uid())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_projects" ON public.projects;
CREATE POLICY "select_own_projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.uid()) = owner_id)
    OR public.is_project_collaborator(id)
  );

DROP POLICY IF EXISTS "insert_own_projects" ON public.projects;
CREATE POLICY "insert_own_projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
  );

DROP POLICY IF EXISTS "update_own_projects" ON public.projects;
CREATE POLICY "update_own_projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
  )
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
  );

DROP POLICY IF EXISTS "delete_own_projects" ON public.projects;
CREATE POLICY "delete_own_projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = owner_id
  );

-- ---------------------------------------------------------------------------
-- 3. project_collaborators RLS policies: optimize with (SELECT auth.jwt())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_project_collaborators" ON public.project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON public.project_collaborators FOR SELECT
  TO authenticated
  USING (
    lower(project_collaborators.email) = lower(((SELECT auth.jwt()) ->> 'email'))
  );
