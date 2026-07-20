/*
# Fix SECURITY DEFINER function exposure on is_project_owner / is_project_collaborator

## Problem
A security scan reported that `anon` and `authenticated` roles can execute
two `SECURITY DEFINER` helper functions via the PostgREST RPC endpoints
(`/rest/v1/rpc/is_project_owner`, `/rest/v1/rpc/is_project_collaborator`).

The functions were created as `SECURITY DEFINER` in a previous migration to
break an infinite RLS recursion between the `projects` and
`project_collaborators` SELECT policies (each policy subqueried the other
table, and both tables have RLS enabled).

`SECURITY DEFINER` functions execute as their owner (a role that bypasses
RLS), so calling them via REST leaks the ability to probe project
ownership / collaborator status with the owner's privileges. The previous
migration did `REVOKE ... FROM PUBLIC` + `GRANT ... TO authenticated`, but
Supabase's default function ACL in the `public` schema explicitly grants
`EXECUTE` to `anon` and `authenticated`, so the `REVOKE FROM PUBLIC` did
not remove those role-specific grants.

## Fix
1. Switch both functions to `SECURITY INVOKER`. They now execute with the
   caller's privileges and RLS context, so calling them via REST is
   harmless — the caller can only see rows they already have access to.
2. Rewrite the `project_collaborators` SELECT policy to be self-access
   only (`lower(email) = lower(auth.jwt() ->> 'email')`), removing the
   `is_project_owner(project_id)` call. This breaks the mutual recursion
   that motivated `SECURITY DEFINER` in the first place: the
   `project_collaborators` SELECT policy no longer references `projects`,
   so there is no cycle.
3. Keep the `projects` SELECT policy calling `is_project_collaborator(id)`.
   With `SECURITY INVOKER`, this function queries `project_collaborators`
   under the caller's RLS. The new `project_collaborators` SELECT policy
   is self-contained (no reference back to `projects`), so there is no
   recursion.
4. Keep the `project_collaborators` INSERT/UPDATE/DELETE policies calling
   `is_project_owner(project_id)`. With `SECURITY INVOKER`, this function
   queries `projects` under the caller's RLS. The `projects` SELECT policy
   short-circuits at `auth.uid() = owner_id` (the function's WHERE clause
   already filters on `owner_id = auth.uid()`), so `is_project_collaborator`
   is never reached — no recursion.
5. Revoke `EXECUTE` from `anon` (not needed by any policy — all policies
   are `TO authenticated`). Keep the grant to `authenticated` so RLS
   policies that call the functions still work.

## Security
- No new tables or columns.
- RLS remains enabled on both `projects` and `project_collaborators`.
- `is_project_owner` and `is_project_collaborator` are now
  `SECURITY INVOKER` — they execute with the caller's privileges and
  cannot bypass RLS.
- `anon` can no longer execute either function.
- `authenticated` retains `EXECUTE` (required for RLS policy evaluation)
  but the functions are harmless to call directly because they run under
  the caller's own RLS context.
- Access semantics are preserved:
  - `projects` SELECT: owner OR collaborator (by email)
  - `project_collaborators` SELECT: collaborator sees their own rows
    (owner will use server-side service role for collaborator management,
    per feature spec 09)
  - All mutations on both tables remain owner-only.

## Important notes
1. The `project_collaborators` SELECT policy no longer allows project
   OWNERS to read collaborator rows via the anon-key client. This is
   intentional: feature spec 09 specifies server-side service-role
   access for collaborator management. The existing `listSharedProjects`
   query reads a collaborator's OWN rows (filtered by their email), which
   the new policy still allows.
2. This migration is idempotent: functions are replaced, policies are
   dropped then recreated.
3. Recursion safety analysis:
   - `projects` SELECT → calls `is_project_collaborator` → queries
     `project_collaborators` under RLS → policy is `lower(email) = ...`
     (no reference to `projects`) → STOP.
   - `project_collaborators` INSERT/UPDATE/DELETE → calls
     `is_project_owner` → queries `projects` under RLS → policy is
     `auth.uid() = owner_id OR is_project_collaborator(id)` →
     `auth.uid() = owner_id` is TRUE (function WHERE clause guarantees
     it) → OR short-circuits → `is_project_collaborator` never called →
     STOP.
*/

-- ---------------------------------------------------------------------------
-- Convert helper functions to SECURITY INVOKER
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_owner(project_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
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
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaborators c
    WHERE c.project_id = project_uuid
      AND lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- Remove execute from anon (not needed — all policies are TO authenticated).
-- Keep execute for authenticated (RLS policies call these functions).
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_owner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_project_collaborator(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_project_collaborator(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_project_collaborator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- project_collaborators SELECT policy: self-access only (breaks recursion)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_project_collaborators" ON project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON project_collaborators FOR SELECT
  TO authenticated
  USING (
    lower(project_collaborators.email) = lower(auth.jwt() ->> 'email')
  );

-- ---------------------------------------------------------------------------
-- projects SELECT policy: owner OR collaborator (unchanged logic)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_projects" ON projects;
CREATE POLICY "select_own_projects"
  ON projects FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_project_collaborator(id)
  );

-- ---------------------------------------------------------------------------
-- project_collaborators mutation policies: owner-only (unchanged logic)
-- ---------------------------------------------------------------------------
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