/*
# Drop old overloaded collaborator functions (2-param versions)

## Problem
The previous migration used CREATE OR REPLACE to change the parameter
signature of `add_project_collaborator` and `remove_project_collaborator`.
However, CREATE OR REPLACE cannot change a function's parameter list —
it creates a new overloaded function instead. Both the old 2-param
versions (which use `auth.uid()` and fail via PostgREST RPC) and the new
3-param versions (which accept `owner_uuid`) exist. PostgREST calls the
old broken versions, causing the 500 error to persist.

## Fix
DROP the old 2-param overloads so only the 3-param versions remain.

## Important notes
1. DROP FUNCTION IF EXISTS with the exact old signature (uuid, text) —
   only removes the 2-param version, leaves the 3-param version intact.
2. No data loss — these are function definitions only, not tables.
3. After this, PostgREST has exactly one function to call per name.
*/

DROP FUNCTION IF EXISTS public.add_project_collaborator(uuid, text);
DROP FUNCTION IF EXISTS public.remove_project_collaborator(uuid, text);
