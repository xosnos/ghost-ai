/*
# Fix delete_project to return boolean instead of void

## Problem
PostgREST has issues with PL/pgSQL functions that return `void` — the
RPC response can be interpreted as an error by the supabase-js client,
causing "Failed to delete project" even though the deletion succeeds.

## Fix
DROP and recreate with return type `boolean`, returning `true` on success.
This matches the pattern used by `remove_project_collaborator` (which
returns `integer` and works correctly).
*/

DROP FUNCTION IF EXISTS public.delete_project(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_project(project_uuid uuid, owner_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = owner_uuid
  ) THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  DELETE FROM public.projects WHERE id = project_uuid;
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_project(uuid, uuid) TO authenticated;
