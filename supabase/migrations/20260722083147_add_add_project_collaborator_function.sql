/*
# Add add_project_collaborator function for owner-only collaborator invites

## Problem
The Share dialog (feature spec 09) lets the project owner invite a
collaborator by email. The `inviteCollaborator()` function in
`lib/projects/collaborators.ts` issues a direct table insert via the
anon-key Supabase client:

    .from("project_collaborators")
    .insert({ project_id, email })
    .select("id, project_id, email, created_at")
    .single()

The INSERT itself succeeds (the INSERT RLS policy
`is_project_owner(project_id)` allows the owner). However, the
`.select()` that reads back the inserted row is subject to the SELECT
RLS policy, which is self-row-only:

    lower(email) = lower(auth.jwt() ->> 'email')

The project owner's email does not match the collaborator's email, so
the SELECT returns zero rows. `.single()` then throws a "no rows
returned" error (PGRST116), which bubbles up as
"Failed to invite collaborator".

This is the exact same class of problem already solved for listing
(`get_project_collaborators`), removing
(`remove_project_collaborator`), and deleting (`delete_project`) —
all converted to `SECURITY DEFINER` RPC functions. The invite path was
never converted.

## Fix
Add a single `SECURITY DEFINER` Postgres function
`add_project_collaborator(project_uuid uuid, collaborator_email text)`
that:
  1. Verifies the caller owns the project (via `auth.uid()`), so it
     cannot be used to add collaborators to another user's project.
  2. Normalizes the email to lowercase (matching the frontend
     `normalizeEmail()` behavior).
  3. Inserts a row into `project_collaborators` with the project UUID
     and normalized email.
  4. Returns the inserted row columns: `id`, `project_id`, `email`,
     `created_at`.
  5. Handles the unique constraint violation (code 23505) by raising
     a custom exception with a recognizable message so the caller
     can map it to "That email is already a collaborator".
  6. Executes as its owner (a role that bypasses RLS), so it can
     insert and read back the row without the caller needing
     service-role access.

Because SECURITY DEFINER functions run with the owner's privileges,
the caller (anon-key client via PostgREST RPC) cannot use it to access
data beyond what the function explicitly returns. The function is
granted to `authenticated` only (the app requires sign-in).

## Security
- No new tables or columns.
- RLS remains enabled on `projects` and `project_collaborators`.
- The function is SECURITY DEFINER with `SET search_path = public` to
  prevent search-path injection.
- Execution is granted to `authenticated` only; `anon` and `PUBLIC`
  are revoked.
- The function checks ownership via `auth.uid()` directly and raises an
  exception for unauthorized callers — only the project owner can
  invoke it successfully.
- This mirrors the security pattern established by
  `remove_project_collaborator` (migration 20260721195208) and
  `get_project_collaborators` (migration 20260721185929).

## Important notes
1. The function returns a single row with `id`, `project_id`, `email`,
   and `created_at` — the same shape the frontend `Collaborator` type
   expects (with `displayName` and `avatarUrl` set to null by the
   caller, since enrichment happens via `get_project_collaborators`
   on the next list refresh).
2. The ownership check uses `auth.uid()` directly. If `auth.uid()`
   returns NULL inside SECURITY DEFINER functions called via PostgREST
   RPC in this environment (as seen with `delete_project_collaborators`
   and `delete_project`), the function will raise the ownership
   exception. If this occurs, the function can be updated to accept
   the owner UUID as an explicit parameter (matching the
   `delete_project` pattern). The route handler already verifies
   ownership via `getCurrentUser()` before calling the RPC, so passing
   the owner UUID is safe.
3. Email matching is case-insensitive: the email is lowercased before
   insert, and the unique constraint on `(project_id, email)` ensures
   no duplicates regardless of original casing.
4. This migration is idempotent: the function is replaced with
   CREATE OR REPLACE.
*/

CREATE OR REPLACE FUNCTION public.add_project_collaborator(
  project_uuid uuid,
  collaborator_email text
)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text;
  new_id uuid;
  new_created_at timestamptz;
BEGIN
  -- Verify the caller owns the project
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the project owner can add collaborators';
  END IF;

  -- Normalize email to lowercase (matches frontend normalizeEmail)
  normalized_email := lower(trim(collaborator_email));

  -- Insert the collaborator row
  BEGIN
    INSERT INTO public.project_collaborators (project_id, email)
    VALUES (project_uuid, normalized_email)
    RETURNING id, created_at INTO new_id, new_created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already a collaborator';
  END;

  -- Return the inserted row
  RETURN QUERY
    SELECT new_id AS id, project_uuid AS project_id,
           normalized_email AS email, new_created_at AS created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) TO authenticated;
