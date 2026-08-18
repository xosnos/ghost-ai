/*
# Create task_runs table, durable ai-generation queue, and recovery cron

## Summary
Implements Feature 22: Design Agent API & Durable Queue Worker infrastructure.
1. `task_runs` relational table with lifecycle states, constraints, partial unique active index, and RLS.
2. `pgmq` queue `ai-generation` with `pgmq_public` schema wrapper and service_role security.
3. Transactional `public.enqueue_task_run` function (SECURITY INVOKER) ensuring atomic DB + queue creation.
4. Supabase Vault helper and `pg_cron` recovery job invoking `ai-worker` every 30 seconds.
*/

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ---------------------------------------------------------------------------
-- 2. task_runs Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('design', 'spec')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'retrying', 'completed', 'failed')),
  attempt_count smallint NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT task_runs_terminal_timestamps_check CHECK (
    (status IN ('completed', 'failed') AND completed_at IS NOT NULL AND completed_at >= created_at AND (started_at IS NULL OR completed_at >= started_at))
    OR
    (status IN ('queued', 'running', 'retrying') AND completed_at IS NULL)
  ),
  CONSTRAINT task_runs_start_timestamp_check CHECK (started_at IS NULL OR started_at >= created_at)
);

-- Separate foreign key indexes
CREATE INDEX IF NOT EXISTS task_runs_project_id_idx ON public.task_runs (project_id);
CREATE INDEX IF NOT EXISTS task_runs_user_id_idx ON public.task_runs (user_id);

-- Partial unique index: Enforces one active AI run per project
CREATE UNIQUE INDEX IF NOT EXISTS task_runs_active_project_idx
  ON public.task_runs (project_id)
  WHERE status IN ('queued', 'running', 'retrying');

-- RLS
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_task_runs" ON public.task_runs;
CREATE POLICY "select_task_runs"
  ON public.task_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = task_runs.project_id
        AND (p.owner_id = (SELECT auth.uid()) OR public.is_project_collaborator(p.id))
    )
  );

-- Grants: Browser can only SELECT; mutations reserved for server/Edge Function
GRANT SELECT ON public.task_runs TO authenticated;
GRANT ALL ON public.task_runs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.task_runs FROM anon, authenticated;

-- Add to Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.task_runs;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Durable Queue (pgmq)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA pgmq TO service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA pgmq TO service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA pgmq TO service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA pgmq TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgmq GRANT ALL ON TABLES TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgmq GRANT ALL ON SEQUENCES TO service_role, postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgmq GRANT ALL ON FUNCTIONS TO service_role, postgres;
REVOKE ALL ON SCHEMA pgmq FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'ai-generation') THEN
    PERFORM pgmq.create('ai-generation');
  END IF;
END $$;

-- Enable RLS on queue tables
ALTER TABLE pgmq."q_ai-generation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgmq."a_ai-generation" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. pgmq_public Queue API
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS pgmq_public;

CREATE OR REPLACE FUNCTION pgmq_public.send(
  queue_name text,
  message jsonb,
  delay integer DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN pgmq.send(queue_name := queue_name, msg := message, delay := delay);
END;
$$;

CREATE OR REPLACE FUNCTION pgmq_public.read(
  queue_name text,
  sleep_seconds integer,
  n integer
)
RETURNS SETOF pgmq.message_record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.read(queue_name := queue_name, vt := sleep_seconds, qty := n);
END;
$$;

CREATE OR REPLACE FUNCTION pgmq_public.archive(
  queue_name text,
  message_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN pgmq.archive(queue_name := queue_name, msg_id := message_id);
END;
$$;

CREATE OR REPLACE FUNCTION pgmq_public.delete(
  queue_name text,
  message_id bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN pgmq.delete(queue_name := queue_name, msg_id := message_id);
END;
$$;

CREATE OR REPLACE FUNCTION pgmq_public.pop(
  queue_name text
)
RETURNS SETOF pgmq.message_record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.pop(queue_name := queue_name);
END;
$$;

CREATE OR REPLACE FUNCTION pgmq_public.set_vt(
  queue_name text,
  message_id bigint,
  sleep_seconds integer
)
RETURNS SETOF pgmq.message_record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pgmq, public
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.set_vt(queue_name := queue_name, msg_id := message_id, vt := sleep_seconds);
END;
$$;

-- Protect pgmq_public: Only privileged server role can call
GRANT USAGE ON SCHEMA pgmq_public TO service_role, postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA pgmq_public TO service_role, postgres;
REVOKE ALL ON SCHEMA pgmq_public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pgmq_public FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Transactional Enqueue Function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_task_run(
  p_project_id uuid,
  p_user_id uuid,
  p_kind text,
  p_input jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pgmq
AS $$
DECLARE
  v_run_id uuid;
  v_msg jsonb;
BEGIN
  -- 1. Create queued task_runs row
  -- Fails with unique_violation if an active run already exists for this project
  INSERT INTO public.task_runs (
    project_id,
    user_id,
    kind,
    status,
    attempt_count
  ) VALUES (
    p_project_id,
    p_user_id,
    p_kind,
    'queued',
    0
  )
  RETURNING id INTO v_run_id;

  -- 2. Build message payload
  v_msg := jsonb_build_object(
    'run_id', v_run_id,
    'kind', p_kind,
    'project_id', p_project_id,
    'user_id', p_user_id,
    'input', p_input,
    'created_at', now()
  );

  -- 3. Send queue message to 'ai-generation'
  PERFORM pgmq.send('ai-generation', v_msg);

  -- 4. Return the run ID
  RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_task_run(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_task_run(uuid, uuid, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_task_run(uuid, uuid, text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_task_run(uuid, uuid, text, jsonb) TO service_role, postgres;

-- ---------------------------------------------------------------------------
-- 6. Vault Secret Helper & Cron Recovery
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vault_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = secret_name;
  RETURN v_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(text) TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.get_cron_job(p_jobname text)
RETURNS TABLE (
  jobid bigint,
  schedule text,
  command text,
  nodename text,
  nodeport integer,
  database text,
  username text,
  active boolean,
  jobname text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = cron, public
AS $$
  SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
  FROM cron.job
  WHERE jobname = p_jobname;
$$;

REVOKE ALL ON FUNCTION public.get_cron_job(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_job(text) TO service_role, postgres;

-- Seed default local automation secret in Vault if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'automations') THEN
    PERFORM vault.create_secret('sb_secret_automations_ghost_ai_2026', 'automations');
  END IF;
END $$;

-- Schedule Cron recovery job every 30 seconds
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
      url := 'http://supabase_kong_ghost-ai:8000/functions/v1/ai-worker',
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
