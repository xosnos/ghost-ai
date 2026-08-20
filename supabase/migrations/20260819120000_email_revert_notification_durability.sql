/*
# Durable email-revert notifications

Adds a pgmq queue, delivery tracking on email_change_reversions, trigger enqueue +
fast-path wake-up, and a cron recovery job for account-mailer.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'email-revert') THEN
    PERFORM pgmq.create('email-revert');
  END IF;
END $$;

ALTER TABLE pgmq."q_email-revert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgmq."a_email-revert" ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_change_reversions
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_last_error text;

CREATE OR REPLACE FUNCTION public.mark_email_revert_notification_sent(p_reversion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_change_reversions
  SET
    notification_sent_at = now(),
    notification_last_error = NULL
  WHERE id = p_reversion_id
    AND notification_sent_at IS NULL;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_email_revert_notification_sent(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_revert_notification_sent(uuid)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.mark_email_revert_notification_failed(
  p_reversion_id uuid,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_change_reversions
  SET
    notification_attempts = notification_attempts + 1,
    notification_last_error = left(p_error, 500)
  WHERE id = p_reversion_id
    AND notification_sent_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_email_revert_notification_failed(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_revert_notification_failed(uuid, text)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pgmq
AS $$
DECLARE
  raw_token text;
  token_hash_value text;
  expires timestamptz;
  reversion_id uuid;
  queue_payload jsonb;
BEGIN
  IF OLD.email IS NOT DISTINCT FROM NEW.email THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.email_change_source', true) = 'revert' THEN
    RETURN NEW;
  END IF;

  UPDATE public.email_change_reversions
  SET consumed_at = now()
  WHERE user_id = NEW.id
    AND consumed_at IS NULL;

  raw_token := encode(gen_random_bytes(32), 'hex');
  token_hash_value := encode(digest(raw_token, 'sha256'), 'hex');
  expires := now() + interval '7 days';

  INSERT INTO public.email_change_reversions (
    user_id,
    old_email,
    new_email,
    token_hash,
    expires_at
  )
  VALUES (
    NEW.id,
    lower(OLD.email),
    lower(NEW.email),
    token_hash_value,
    expires
  )
  RETURNING id INTO reversion_id;

  PERFORM public.reassign_collaborator_email(OLD.email, NEW.email);

  queue_payload := jsonb_build_object(
    'reversion_id', reversion_id,
    'user_id', NEW.id,
    'old_email', lower(OLD.email),
    'new_email', lower(NEW.email),
    'raw_token', raw_token,
    'expires_at', expires
  );

  PERFORM pgmq.send('email-revert', queue_payload);

  PERFORM net.http_post(
    url := public.get_vault_secret('account_mailer_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', public.get_vault_secret('automations'),
      'Authorization', 'Bearer ' || public.get_vault_secret('automations')
    ),
    body := '{}'::jsonb
  );

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'account-mailer-recovery') THEN
    PERFORM cron.unschedule('account-mailer-recovery');
  END IF;

  PERFORM cron.schedule(
    'account-mailer-recovery',
    '30 seconds',
    $cmd$
    SELECT net.http_post(
      url := public.get_vault_secret('account_mailer_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', public.get_vault_secret('automations'),
        'Authorization', 'Bearer ' || public.get_vault_secret('automations')
      ),
      body := '{}'::jsonb
    ) AS request_id
    WHERE public.get_vault_secret('account_mailer_url') IS NOT NULL
      AND public.get_vault_secret('automations') IS NOT NULL;
    $cmd$
  );
END $$;
