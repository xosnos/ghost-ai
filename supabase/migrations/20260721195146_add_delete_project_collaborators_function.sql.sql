/*
# Add delete_project_collaborators function for owner-only collaborator cleanup

## Problem
When a project owner deletes their project, the route handler calls
`deleteProjectCollaborators()` which issues a DELETE on
`project_collaborators` via the anon-key Supabase client. The
`project_collaborators` SELECT RLS policy is self-row-only
(`lower(email) = lower(auth.jwt() ->> 'email')`), so the owner — who is
NOT a collaborator on their own project — can see zero rows in the table.
PostgREST implements DELETE by first SELECTing matching rows (subject to
SELECT RLS), so the DELETE finds nothing and the operation fails.

This is the same class of problem that motivated the
`get_project_collaborators` SECURITY DEFINER function: the owner needs
to operate on collaborator rows they cannot see under the current RLS.

## Fix
Add a `SECURITY DEFINER` Postgres function
`delete_project_collaborators(project_uuid uuid)` that:
  1. Verifies the caller owns the project (via auth.uid()), so it cannot
     be used to delete another user's collaborators.
  2. Deletes all `project_collaborators` rows for that project.
  3. Executes as its owner (a role that bypasses RLS), so it can delete
     rows the caller cannot see through the anon-key client.

Because SECURITY DEFINER functions run with the owner's privileges, the
caller (anon-key client via PostgREST RPC) cannot use it to access data
beyond what the function explicitly does. The function is granted to
`authenticated` only (the app requires sign-in).

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
  `get_project_collaborators` (migration 20260721185929).

## Important notes
1. The function returns void (no result set needed).
2. The ownership check uses auth.uid() directly (not the
  is_project_owner helper) to avoid any RLS recursion concerns, since
  the function runs as SECURITY DEFINER and bypasses RLS anyway.
3. This migration is idempotent: the function is replaced with
   CREATE OR REPLACE.
*/

-- ---------------------------------------------------------------------------
-- delete_project_collaborators: deletes all collaborators for a project
-- SECURITY DEFINER so it can delete rows the owner cannot see via RLS.
-- Only the project owner may call this function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_project_collaborators(project_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project owner can delete collaborators';
  END IF;

  DELETE FROM public.project_collaborators
  WHERE project_id = project_uuid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_project_collaborators(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_project_collaborators(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_project_collaborators(uuid) TO authenticated;
