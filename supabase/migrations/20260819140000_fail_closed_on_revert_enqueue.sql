/*
# Fail closed on revert enqueue; guard mailer wake-up Vault lookups

Keep Auth email changes from committing without a queued revert
notification. Vault lookups and mailer wake-up stay outside the enqueue
path so a raised get_vault_secret or HTTP error cannot roll back the
queued message. Wake-up HTTP remains best-effort because cron recovers
queued messages.
*/

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
  mailer_url text;
  automation_secret text;
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

  BEGIN
    mailer_url := public.get_vault_secret('account_mailer_url');
    automation_secret := public.get_vault_secret('automations');

    IF mailer_url IS NOT NULL AND automation_secret IS NOT NULL THEN
      PERFORM net.http_post(
        url := mailer_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', automation_secret,
          'Authorization', 'Bearer ' || automation_secret
        ),
        body := '{}'::jsonb
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'account-mailer wake-up failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
