/*
# Bind owner RPCs to auth.uid(), lock EXECUTE, rotate leaked worker secrets

## Owner RPCs
delete_project, add_project_collaborator, and remove_project_collaborator
were SECURITY DEFINER functions that trusted a client-supplied owner_uuid.
get_project_collaborators already uses auth.uid() successfully in the same
PostgREST RPC path, so the NULL-uid workaround is unnecessary and unsafe.

Drop the owner_uuid parameter. Authorize with auth.uid(). Revoke EXECUTE
from PUBLIC and anon.

## Worker secrets
The committed Vault placeholder sb_secret_automations_ghost_ai_2026 is
treated as compromised. If it is still stored, replace it with a random
value so the leaked string stops working.

Cron previously posted to the local Kong Docker hostname. Store the worker
URL in Vault (ai_worker_url) and read it from the Cron command. Local seed
sets the Kong URL; hosted projects must set the project Functions URL.
*/

-- ---------------------------------------------------------------------------
-- delete_project(project_uuid)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_project(uuid, uuid);
DROP FUNCTION IF EXISTS public.delete_project(uuid);

CREATE FUNCTION public.delete_project(project_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Only the project owner can delete this project';
  END IF;

  DELETE FROM public.projects WHERE id = project_uuid;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_project(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_project(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- add_project_collaborator(project_uuid, collaborator_email)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.add_project_collaborator(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.add_project_collaborator(uuid, text);

CREATE FUNCTION public.add_project_collaborator(
  project_uuid uuid,
  collaborator_email text
)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  v_normalized_email text;
  v_new_id uuid;
  v_new_created_at timestamptz;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Only the project owner can add collaborators';
  END IF;

  v_normalized_email := lower(trim(collaborator_email));

  BEGIN
    INSERT INTO public.project_collaborators (project_id, email)
    VALUES (project_uuid, v_normalized_email)
    RETURNING project_collaborators.id, project_collaborators.created_at
    INTO v_new_id, v_new_created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'That email is already a collaborator';
  END;

  RETURN QUERY
    SELECT v_new_id, project_uuid, v_normalized_email, v_new_created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_project_collaborator(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- remove_project_collaborator(project_uuid, collaborator_email)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.remove_project_collaborator(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.remove_project_collaborator(uuid, text);

CREATE FUNCTION public.remove_project_collaborator(
  project_uuid uuid,
  collaborator_email text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  deleted_count integer;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_uuid AND p.owner_id = caller_id
  ) THEN
    RAISE EXCEPTION 'Only the project owner can remove collaborators';
  END IF;

  DELETE FROM public.project_collaborators
  WHERE project_id = project_uuid
    AND lower(email) = lower(collaborator_email);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_project_collaborator(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Rotate leaked automations secret and point Cron at a Vault worker URL
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_id uuid;
  v_current text;
BEGIN
  SELECT id, decrypted_secret INTO v_id, v_current
  FROM vault.decrypted_secrets
  WHERE name = 'automations';

  IF v_id IS NULL THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'automations');
  ELSIF v_current = 'sb_secret_automations_ghost_ai_2026' THEN
    PERFORM vault.update_secret(v_id, encode(extensions.gen_random_bytes(32), 'hex'));
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = 'ai_worker_url';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      'http://supabase_kong_ghost-ai:8000/functions/v1/ai-worker',
      'ai_worker_url'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ai-worker-recovery') THEN
    PERFORM cron.unschedule('ai-worker-recovery');
  END IF;

  PERFORM cron.schedule(
    'ai-worker-recovery',
    '30 seconds',
    $cmd$
    SELECT net.http_post(
      url := public.get_vault_secret('ai_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', public.get_vault_secret('automations'),
        'Authorization', 'Bearer ' || public.get_vault_secret('automations')
      ),
      body := '{}'::jsonb
    ) AS request_id;
    $cmd$
  );
END $$;
