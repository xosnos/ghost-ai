/*
# Fix ambiguous column reference in add_project_collaborator

## Problem
The function's PL/pgSQL variables `new_id` and `new_created_at` conflict
with the `RETURNING id, created_at` clause in the INSERT statement,
causing: ERROR: column reference "id" is ambiguous — it could refer to
either a PL/pgSQL variable or a table column.

This happens because the RETURNING clause output column names match
the INTO target variable names, and PL/pgSQL resolves them ambiguously.

## Fix
Rename the PL/pgSQL variables to use a `v_` prefix to avoid any collision
with table column names in RETURNING clauses.

Also clean up the test collaborator that may have been partially inserted.
*/

-- Clean up any partial test data (the function may have inserted before erroring)
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
    RETURNING id, created_at INTO v_new_id, v_new_created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already a collaborator';
  END;

  RETURN QUERY
    SELECT v_new_id AS id, project_uuid AS project_id,
           v_normalized_email AS email, v_new_created_at AS created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text, uuid) TO authenticated;
