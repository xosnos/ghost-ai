/*
# Fix case-insensitive email matching in collaborator RLS policies

## Problem
The `is_project_collaborator` SECURITY DEFINER helper function and the
`select_own_project_collaborators` SELECT policy both compared the
`project_collaborators.email` column against the signed-in user's JWT email
claim using strict, case-sensitive equality (`c.email = auth.jwt() ->> 'email'`).

Supabase Auth normalizes user emails to lowercase in `auth.users` and in the
JWT `email` claim. A collaborator row stored with mixed-case casing
(e.g. `User@Example.com`) would therefore never match the lowercased JWT
claim, silently denying the invited collaborator access to the shared project
even though their row exists.

## Fix
Apply `lower()` to both sides of the email comparison in both locations so the
match is case-insensitive regardless of how the collaborator email was stored:

1. `is_project_collaborator(uuid)` helper function (used by the `projects`
   SELECT policy) — `lower(c.email) = lower(auth.jwt() ->> 'email')`.
2. `select_own_project_collaborators` SELECT policy on `project_collaborators`
   — `lower(project_collaborators.email) = lower(auth.jwt() ->> 'email')`.

## Security
- No new tables or columns.
- RLS remains enabled on `project_collaborators` and `projects`.
- The `SECURITY DEFINER` function still executes as its owner and bypasses RLS
  internally (preventing the previously-fixed policy recursion); only the
  comparison expression inside it changes.
- Mutation policies (INSERT/UPDATE/DELETE) remain owner-only and are
  unchanged.
- `EXECUTE` grants on the helper functions remain restricted to `authenticated`.

## Important notes
1. `lower()` is applied to BOTH the stored column value and the JWT claim so
   neither side's casing matters.
2. This migration is idempotent: functions and policies are dropped/recreated.
3. Only the email comparison expressions change; access semantics (owner OR
   collaborator-by-email) are preserved.
*/

-- ---------------------------------------------------------------------------
-- Helper function: case-insensitive email match
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_projects" ON projects;

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
      AND lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_project_collaborator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_project_collaborator(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- projects SELECT policy (calls the updated helper)
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
-- project_collaborators SELECT policy (case-insensitive email match)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "select_own_project_collaborators" ON project_collaborators;
CREATE POLICY "select_own_project_collaborators"
  ON project_collaborators FOR SELECT
  TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR lower(project_collaborators.email) = lower(auth.jwt() ->> 'email')
  );
