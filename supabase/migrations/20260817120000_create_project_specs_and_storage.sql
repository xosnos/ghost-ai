/*
# Create project_specs table and specs storage bucket

## Summary
Implements Feature 27: Spec Generation Flow metadata and artifact storage.
1. `project_specs` relational table linking task runs to generated markdown spec files in Supabase Storage.
2. Unique constraint and index on `task_run_id` ensuring idempotent 1:1 relationship between run and spec.
3. Foreign key and index on `project_id`.
4. RLS on `project_specs` allowing read access to project owner and collaborators; write access restricted to service_role.
5. Private `specs` Supabase Storage bucket with access policies scoped to project members.
*/

-- ---------------------------------------------------------------------------
-- 1. project_specs Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_run_id uuid NOT NULL UNIQUE REFERENCES public.task_runs(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Foreign key index on project_id (task_run_id is already indexed by UNIQUE constraint)
CREATE INDEX IF NOT EXISTS project_specs_project_id_idx ON public.project_specs (project_id);

-- RLS
ALTER TABLE public.project_specs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_project_specs" ON public.project_specs;
CREATE POLICY "select_project_specs"
  ON public.project_specs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_specs.project_id
        AND (p.owner_id = (SELECT auth.uid()) OR public.is_project_collaborator(p.id))
    )
  );

-- Grants: Browser can only SELECT; mutations reserved for server/Edge Function
GRANT SELECT ON public.project_specs TO authenticated;
GRANT ALL ON public.project_specs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.project_specs FROM anon, authenticated;

-- Add to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'project_specs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.project_specs;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. specs Storage Bucket
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'specs',
  'specs',
  false,
  10485760, -- 10MB limit
  ARRAY['text/markdown', 'text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['text/markdown', 'text/plain', 'application/octet-stream'];

-- Helper to extract project ID from storage object path:
-- Supports both 'specs/{projectId}/{runId}.md' and '{projectId}/{runId}.md'
CREATE OR REPLACE FUNCTION public.specs_project_id(object_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE
    WHEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.md$') IS NOT NULL
      THEN substring(object_name FROM '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.md$')::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.specs_project_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.specs_project_id(text) TO authenticated;

-- Storage object policies for specs bucket
DROP POLICY IF EXISTS "specs_bucket_authenticated_select" ON storage.objects;
CREATE POLICY "specs_bucket_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'specs'
    AND (
      public.is_project_owner(public.specs_project_id(name))
      OR public.is_project_collaborator(public.specs_project_id(name))
    )
  );
