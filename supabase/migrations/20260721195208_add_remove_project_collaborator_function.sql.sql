/*
# Add remove_project_collaborator function for owner-only single collaborator removal

## Problem
The Share dialog (feature spec 09) lets the project owner remove a single
collaborator by email. The `removeCollaborator()` function in
`lib/projects/collaborators.ts` issues a DELETE on `project_collaborators`
via the anon-key Supabase client with `.delete().eq(...).ilike(...).select("id")`.
PostgREST implements DELETE by first SELECTing matching rows (subject to
SELECT RLS). The `project_collaborators` SELECT RLS policy is self-row-only
(`lower(email) = lower(auth.jwt() ->> 'email')`), so the owner — who is NOT
a collaborator on their own project — can see zero rows. The DELETE finds
nothing, `.select("id")` returns an empty array, and the function throws
"Collaborator not found" even though the collaborator exists.

This is the same class of problem solved by `get_project_collaborators`
and `delete_project_collaborators`: the owner needs to operate on
collaborator rows they cannot see under the current RLS.

## Fix
Add a `SECURITY DEFINER` Postgres function
`remove_project_collaborator(project_uuid uuid, collaborator_email text)` that:
  1. Verifies the caller owns the project (via auth.uid()), so it cannot
     be used to remove collaborators from another user's project.
  2. Deletes the single `project_collaborators` row matching the project
     and email (case-insensitive).
  3. Returns the number of deleted rows (0 or 1) so the caller can
     distinguish "removed" from "not found".
  4. Executes as its owner (a role that bypasses RLS), so it can delete
     rows the caller cannot see through the anon-key client.

## Security
- No new tables or columns.
- RLS remains enabled on `projects` and `project_collaborators`.
- The function is SECURITY DEFINER with `SET search_path = public` to
  prevent search-path injection.
- Execution is granted to `authenticated` only; `anon` is revoked.
- The function checks ownership via auth.uid() and raises an exception
  for unauthorized callers — only the project owner can invoke it
  successfully.
- This mirrors the security pattern established by
  `get_project_collaborators` (migration 20260721185929) and
  `delete_project_collaborators`.

## Important notes
1. The function returns an integer: 1 if a row was deleted, 0 if not.
2. The ownership check uses auth.uid() directly (not the is_project_owner
   helper) to avoid any RLS recursion concerns, since the function runs
   as SECURITY DEFINER and bypasses RLS anyway.
3. Email matching is case-insensitive (lower()) to match the existing
   normalizeEmail() behavior in the frontend.
4. This migration is idempotent: the function is replaced with
   CREATE OR REPLACE.
*/

-- ---------------------------------------------------------------------------
-- remove_project_collaborator: removes a single collaborator by email
-- SECURITY DEFINER so it can delete rows the owner cannot see via RLS.
-- Only the project owner may call this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_project_collaborator(
  project_uuid uuid,
  collaborator_email text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project owner can remove collaborators';
  END IF;

  DELETE FROM public.project_collaborators
  WHERE project_id = project_uuid
    AND lower(email) = lower(collaborator_email);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) TO authenticated;
