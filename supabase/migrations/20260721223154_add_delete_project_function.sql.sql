/*
# Add delete_project SECURITY DEFINER function

## Context
Project deletion was failing because the `projects` DELETE RLS policy
(`auth.uid() = owner_id`) and the `project_collaborators` DELETE RLS policy
(`is_project_owner(project_id)`) create a cross-table RLS recursion during
the CASCADE delete. When PostgREST issues `DELETE FROM projects WHERE id = ?`,
the CASCADE fires on `project_collaborators`, which triggers the
`is_project_owner` function, which queries `projects` again under RLS —
causing infinite recursion or policy evaluation failures.

Previous attempt used `auth.uid()` inside a SECURITY DEFINER function, but
`auth.uid()` returns NULL inside SECURITY DEFINER functions called via
PostgREST RPC in this environment. This function takes the owner's user ID
as an explicit parameter instead, which the route handler already verifies
via `getCurrentUser()` before calling the function.

## Changes
- CREATE FUNCTION `public.delete_project(project_uuid uuid, owner_uuid uuid)`
  - SECURITY DEFINER, bypasses RLS
  - Verifies `projects.owner_id = owner_uuid` (ownership check without auth.uid())
  - Deletes the project row; CASCADE automatically removes collaborators
  - Raises exception if the project doesn't exist or the caller isn't the owner
- GRANT EXECUTE to `authenticated` role only

## Security
- The function performs an explicit ownership check using the passed owner UUID
- The route handler (`app/api/projects/[projectId]/route.ts`) verifies the
  current user via `getCurrentUser()` and checks `existing.ownerId === user.id`
  before calling this function, so `owner_uuid` is always the authenticated user's ID
- SECURITY DEFINER is required to bypass RLS on both `projects` and
  `project_collaborators` during the CASCADE delete

## Important notes
1. This function is idempotent: uses IF EXISTS / IF NOT EXISTS patterns
2. The CASCADE foreign key on `project_collaborators.project_id` handles
   collaborator cleanup automatically — no separate delete needed
3. `auth.uid()` is NOT used inside this function to avoid the NULL issue
   seen with SECURITY DEFINER + PostgREST RPC
*/

CREATE OR REPLACE FUNCTION public.delete_project(project_uuid uuid, owner_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = owner_uuid
  ) THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  DELETE FROM public.projects WHERE id = project_uuid;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_project(uuid, uuid) TO authenticated;
