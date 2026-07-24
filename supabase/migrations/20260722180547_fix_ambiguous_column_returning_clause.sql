/*
# Fix ambiguous column reference in add_project_collaborator (attempt 2)

## Problem
RETURNS TABLE(id uuid, ...) creates PL/pgSQL output variables named
`id`, `project_id`, `email`, `created_at`. The INSERT's
`RETURNING id, created_at` clause is ambiguous because `id` could refer
to the output variable or the table column.

## Fix
Qualify the RETURNING columns with the table name to disambiguate:
`RETURNING project_collaborators.id, project_collaborators.created_at`
*/

-- Clean up any partial test data
DELETE FROM public.project_collaborators
WHERE project_id = '7b9bb59f-232d-40df-b54d-c1b20fc6631e'::uuid
  AND email = 'stevennguyen1021@outlook.com';

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
  v_normalized_email text;
  v_new_id uuid;
  v_new_created_at timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = owner_uuid
  ) THEN
    RAISE EXCEPTION 'Only the project owner can add collaborators';
  END IF;

  v_normalized_email := lower(trim(collaborator_email));

  BEGIN
    INSERT INTO public.project_collaborators (project_id, email)
    VALUES (project_uuid, v_normalized_email)
    RETURNING project_collaborators.id, project_collaborators.created_at
    INTO v_new_id, v_new_created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already a collaborator';
  END;

  RETURN QUERY
    SELECT v_new_id, project_uuid, v_normalized_email, v_new_created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) TO authenticated;
