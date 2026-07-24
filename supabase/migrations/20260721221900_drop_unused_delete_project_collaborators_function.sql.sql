/*
# Drop unused delete_project_collaborators function

## Context
The `delete_project_collaborators` SECURITY DEFINER function was added to
work around the project_collaborators SELECT RLS policy being self-row-only.
The project owner — who is not a collaborator on their own project — could
not see any rows, so PostgREST's DELETE (which first SELECTs matching rows)
found nothing and failed.

However, the `project_collaborators.project_id` foreign key already has
`ON DELETE CASCADE` referencing `projects(id)`. When the project is deleted,
the database automatically removes all collaborator rows. The RPC call was
completely unnecessary — and worse, it was failing because `auth.uid()`
returns NULL inside SECURITY DEFINER functions called via PostgREST RPC,
causing the function to raise "Only the project owner can delete
collaborators" even for the actual owner.

## Changes
- DROP FUNCTION `public.delete_project_collaborators(uuid)`
- No impact on application code — the function is no longer called.
- The CASCADE foreign key handles collaborator cleanup atomically when
  the project is deleted.

## Security
- No tables or columns affected.
- RLS policies on `project_collaborators` remain unchanged.
- The `remove_project_collaborator` and `get_project_collaborators`
  functions are NOT affected by this migration.

## Important notes
1. This migration is idempotent: uses IF EXISTS.
2. The `remove_project_collaborator` function (used by the Share dialog
   for single-collaborator removal) is NOT dropped — it is still needed
   for the Share dialog's remove-collaborator flow.
3. Project deletion now relies solely on the `ON DELETE CASCADE` foreign
   key constraint, which is the correct database-level approach.
*/

DROP FUNCTION IF EXISTS public.delete_project_collaborators(uuid);
