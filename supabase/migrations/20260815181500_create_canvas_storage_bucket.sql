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

-- 2. RLS policies on storage.objects for authenticated users on 'canvas' bucket
DROP POLICY IF EXISTS "canvas_bucket_authenticated_select" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'canvas');

DROP POLICY IF EXISTS "canvas_bucket_authenticated_insert" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'canvas');

DROP POLICY IF EXISTS "canvas_bucket_authenticated_update" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'canvas')
  WITH CHECK (bucket_id = 'canvas');

DROP POLICY IF EXISTS "canvas_bucket_authenticated_delete" ON storage.objects;
CREATE POLICY "canvas_bucket_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'canvas');
