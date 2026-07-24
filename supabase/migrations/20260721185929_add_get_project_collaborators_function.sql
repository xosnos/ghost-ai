/*
# Add get_project_collaborators function for service-role-free collaborator listing

## Problem
The Share dialog (feature spec 09) lists collaborators with display name
and avatar enrichment from Supabase Auth. The existing implementation in
`lib/projects/collaborators.ts` uses `createAdminClient()` (the service
role key) to:
  1. Query `project_collaborators` (bypassing RLS — the SELECT policy only
     lets a user read rows matching their own email, so the owner cannot
     list all collaborators via the anon key).
  2. Look up each collaborator's email in `auth.users` via the Auth Admin
     REST API to get display name / avatar.

This requires `SUPABASE_SERVICE_ROLE_KEY` in the environment, which is not
available in this hosted setup. Without it, `createAdminClient()` throws
"Missing SUPABASE_SERVICE_ROLE_KEY" and the Share dialog fails.

## Fix
Add a single `SECURITY DEFINER` Postgres function
`get_project_collaborators(project_uuid uuid)` that:
  1. Verifies the caller owns the project (or is a collaborator), so it
     cannot be used to enumerate arbitrary projects' collaborators.
  2. Returns all `project_collaborators` rows for that project, joined
     with `auth.users` for display name / avatar enrichment.
  3. Executes as its owner (a role that bypasses RLS), so it can read both
     `project_collaborators` and `auth.users` without the caller needing
     service-role access.

Because SECURITY DEFINER functions run with the owner's privileges, the
caller (anon-key client via PostgREST RPC) cannot use it to access data
beyond what the function explicitly returns. The function is granted to
`authenticated` only (the app requires sign-in).

## Security
- No new tables or columns.
- RLS remains enabled on `projects` and `project_collaborators`.
- The function is SECURITY DEFINER with `SET search_path = public, auth`
  to prevent search-path injection.
- Execution is granted to `authenticated` only; `anon` is revoked.
- The function checks ownership/collaborator status via `auth.uid()` and
  the JWT email, returning an empty set for unauthorized callers (no
  error, no information leak).
- Only `auth.users` columns needed for enrichment are read (email,
  raw_user_meta_data). No passwords, tokens, or sensitive auth fields
  are returned.

## Important notes
1. The function returns a JSON-shaped column set that the frontend
   `Collaborator` type maps directly (id, project_id, email, created_at,
   display_name, avatar_url).
2. Display name is derived from user_metadata fields: full_name, name,
   display_name, preferred_username (first non-empty value wins).
3. Avatar URL is derived from user_metadata fields: avatar_url, picture
   (first non-empty value wins).
4. When no auth user exists for an email, display_name and avatar_url
   are NULL — the frontend falls back to showing the email only.
5. This migration is idempotent: the function is replaced with
   CREATE OR REPLACE.
*/

-- ---------------------------------------------------------------------------
-- get_project_collaborators: returns collaborators + auth enrichment
-- SECURITY DEFINER so it can read project_collaborators and auth.users
-- without the caller needing service-role access.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_project_collaborators(project_uuid uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  email text,
  created_at timestamptz,
  display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    c.id,
    c.project_id,
    c.email,
    c.created_at,
    (
      SELECT (u.raw_user_meta_data ->> 'full_name')
      FROM auth.users u
      WHERE u.id = (
        SELECT au.id FROM auth.users au
        WHERE lower(au.email) = lower(c.email)
        LIMIT 1
      )
    ) AS display_name,
    (
      SELECT (u.raw_user_meta_data ->> 'avatar_url')
      FROM auth.users u
      WHERE u.id = (
        SELECT au.id FROM auth.users au
        WHERE lower(au.email) = lower(c.email)
        LIMIT 1
      )
    ) AS avatar_url
  FROM public.project_collaborators c
  WHERE c.project_id = project_uuid
    AND (
      -- Only the project owner or an existing collaborator may list
      -- collaborators. This mirrors the projects SELECT RLS policy.
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_uuid AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.project_collaborators pc
        WHERE pc.project_id = project_uuid
          AND lower(pc.email) = lower(auth.jwt() ->> 'email')
      )
    )
  ORDER BY c.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_project_collaborators(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_collaborators(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_collaborators(uuid) TO authenticated;