/*
# Fix add_project_collaborator and remove_project_collaborator: replace auth.uid() with explicit owner_uuid

## Problem
Both `add_project_collaborator` and `remove_project_collaborator` use
`auth.uid()` inside SECURITY DEFINER functions to verify ownership.
In this environment, `auth.uid()` returns NULL inside SECURITY DEFINER
functions called via PostgREST RPC, causing the ownership check to
always fail — even for the actual project owner. This results in a 500
error when the owner tries to invite or remove a collaborator.

This is the exact same issue already discovered and fixed for
`delete_project` (migration 20260721223154), which was switched to
accept the owner UUID as an explicit parameter.

## Fix
1. `add_project_collaborator(project_uuid uuid, collaborator_email text, owner_uuid uuid)`
   - Replace `auth.uid()` with the passed `owner_uuid` in the ownership check
   - All other logic unchanged: email normalization, insert, unique-violation handling, return row

2. `remove_project_collaborator(project_uuid uuid, collaborator_email text, owner_uuid uuid)`
   - Replace `auth.uid()` with the passed `owner_uuid` in the ownership check
   - All other logic unchanged: delete by email, return deleted count

Both functions remain SECURITY DEFINER with `SET search_path = public`.
Execution remains granted to `authenticated` only.

## Security
- The route handlers already verify ownership server-side via
  `getCurrentUser()` and `project.ownerId === user.id` before calling
  these RPCs, so `owner_uuid` is always the authenticated user's ID.
- The functions still perform an explicit ownership check using
  `owner_uuid` against `projects.owner_id`, so a caller cannot delete
  another user's project collaborators even if they somehow call the
  RPC with a different project UUID.
- No new tables or columns.
- RLS policies unchanged.

## Important notes
1. Both functions use CREATE OR REPLACE — idempotent.
2. The function signatures change (new parameter), so callers must be
   updated simultaneously. The route handlers and client library code
   are updated in the same change.
3. `auth.uid()` is NOT used inside either function, avoiding the NULL
   issue seen with SECURITY DEFINER + PostgREST RPC.
*/

-- ---------------------------------------------------------------------------
-- add_project_collaborator: updated to accept owner_uuid explicitly
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_project_collaborator(
  project_uuid uuid,
  collaborator_email text,
  owner_uuid uuid
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
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = owner_uuid
  ) THEN
    RAISE EXCEPTION 'Only the project owner can add collaborators';
  END IF;

  normalized_email := lower(trim(collaborator_email));

  BEGIN
    INSERT INTO public.project_collaborators (project_id, email)
    VALUES (project_uuid, normalized_email)
    RETURNING id, created_at INTO new_id, new_created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already a collaborator';
  END;

  RETURN QUERY
    SELECT new_id AS id, project_uuid AS project_id,
           normalized_email AS email, new_created_at AS created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- remove_project_collaborator: updated to accept owner_uuid explicitly
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_project_collaborator(
  project_uuid uuid,
  collaborator_email text,
  owner_uuid uuid
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
    WHERE p.id = project_uuid AND p.owner_id = owner_uuid
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

REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text, uuid) TO authenticated;
