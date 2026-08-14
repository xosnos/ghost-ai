/*
# Include the project owner in get_project_collaborators

The Share dialog listed only rows from project_collaborators. The owner is
stored on projects.owner_id and never appears in that table, so the dialog
omitted the person who owns the project.

Replace get_project_collaborators so the first row is the owner (enriched
from auth.users) followed by invited collaborators. Adds a `role` column
(`owner` | `collaborator`). The return type changes, so the previous
function must be dropped first.
*/

DROP FUNCTION IF EXISTS public.get_project_collaborators(uuid);

CREATE FUNCTION public.get_project_collaborators(project_uuid uuid)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  email text,
  created_at timestamptz,
  display_name text,
  avatar_url text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH allowed AS (
    SELECT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_uuid AND p.owner_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_uuid
        AND lower(pc.email) = lower(auth.jwt() ->> 'email')
    ) AS ok
  ),
  people AS (
    SELECT
      p.owner_id AS id,
      p.id AS project_id,
      u.email::text AS email,
      p.created_at,
      NULLIF(TRIM(COALESCE(
        NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(u.raw_user_meta_data ->> 'name', ''),
        NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
        NULLIF(u.raw_user_meta_data ->> 'preferred_username', '')
      )), '') AS display_name,
      COALESCE(
        NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
        NULLIF(u.raw_user_meta_data ->> 'picture', '')
      ) AS avatar_url,
      'owner'::text AS role
    FROM public.projects p
    LEFT JOIN auth.users u ON u.id = p.owner_id
    WHERE p.id = project_uuid
      AND (SELECT ok FROM allowed)

    UNION ALL

    SELECT
      c.id,
      c.project_id,
      c.email,
      c.created_at,
      (
        SELECT NULLIF(TRIM(COALESCE(
          NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
          NULLIF(u.raw_user_meta_data ->> 'name', ''),
          NULLIF(u.raw_user_meta_data ->> 'display_name', ''),
          NULLIF(u.raw_user_meta_data ->> 'preferred_username', '')
        )), '')
        FROM auth.users u
        WHERE lower(u.email) = lower(c.email)
        LIMIT 1
      ) AS display_name,
      (
        SELECT COALESCE(
          NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
          NULLIF(u.raw_user_meta_data ->> 'picture', '')
        )
        FROM auth.users u
        WHERE lower(u.email) = lower(c.email)
        LIMIT 1
      ) AS avatar_url,
      'collaborator'::text AS role
    FROM public.project_collaborators c
    WHERE c.project_id = project_uuid
      AND (SELECT ok FROM allowed)
  )
  SELECT
    people.id,
    people.project_id,
    people.email,
    people.created_at,
    people.display_name,
    people.avatar_url,
    people.role
  FROM people
  ORDER BY CASE WHEN people.role = 'owner' THEN 0 ELSE 1 END, people.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_project_collaborators(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_project_collaborators(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_project_collaborators(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
