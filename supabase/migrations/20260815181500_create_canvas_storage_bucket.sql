/*
# Create canvas storage bucket and access policies

## Summary
Configures a Supabase Storage bucket named 'canvas' for persisting collaborative
React Flow canvas state snapshots as JSON blobs (e.g. `canvas/{projectId}.json` or `{projectId}.json`),
referenced by `projects.canvas_storage_path`.
*/

-- 1. Create canvas storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canvas',
  'canvas',
  false,
  10485760, -- 10MB limit
  ARRAY['application/json', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/json', 'text/plain'];

-- 2. Resolve the project id from either `project-id.json` or
-- `canvas/project-id.json` without raising on malformed object names.
CREATE OR REPLACE FUNCTION public.canvas_project_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE
    WHEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$') IS NOT NULL
      THEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.json$')::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.canvas_project_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canvas_project_id(text) TO authenticated;

-- 3. RLS policies on storage.objects for authenticated project members
DROP POLICY IF EXISTS "canvas_bucket_authenticated_select" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'canvas'
    AND (
      public.is_project_owner(public.canvas_project_id(name))
      OR public.is_project_collaborator(public.canvas_project_id(name))
    )
  );

DROP POLICY IF EXISTS "canvas_bucket_authenticated_insert" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'canvas'
    AND (
      public.is_project_owner(public.canvas_project_id(name))
      OR public.is_project_collaborator(public.canvas_project_id(name))
    )
  );

DROP POLICY IF EXISTS "canvas_bucket_authenticated_update" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'canvas'
    AND (
      public.is_project_owner(public.canvas_project_id(name))
      OR public.is_project_collaborator(public.canvas_project_id(name))
    )
  )
  WITH CHECK (
    bucket_id = 'canvas'
    AND (
      public.is_project_owner(public.canvas_project_id(name))
      OR public.is_project_collaborator(public.canvas_project_id(name))
    )
  );

DROP POLICY IF EXISTS "canvas_bucket_authenticated_delete" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'canvas'
    AND (
      public.is_project_owner(public.canvas_project_id(name))
      OR public.is_project_collaborator(public.canvas_project_id(name))
    )
  );
