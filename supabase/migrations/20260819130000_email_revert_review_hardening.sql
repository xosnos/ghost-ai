/*
# Email revert review hardening

Guards mailer wake-up so missing Vault config cannot roll back an Auth email
change, clears pending GoTrue email-change state on revert, updates the email
identity, and revokes sessions in the same transaction.
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

  BEGIN
    PERFORM pgmq.send('email-revert', queue_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'email-revert enqueue failed: %', SQLERRM;
  END;

  mailer_url := public.get_vault_secret('account_mailer_url');
  automation_secret := public.get_vault_secret('automations');

  IF mailer_url IS NOT NULL AND automation_secret IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := mailer_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', automation_secret,
          'Authorization', 'Bearer ' || automation_secret
        ),
        body := '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'account-mailer wake-up failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_email_revert(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  token_hash_value text;
  revert_row public.email_change_reversions%ROWTYPE;
BEGIN
  token_hash_value := encode(digest(p_token, 'sha256'), 'hex');

  SELECT *
  INTO revert_row
  FROM public.email_change_reversions
  WHERE token_hash = token_hash_value
  FOR UPDATE;

  IF NOT FOUND
    OR revert_row.consumed_at IS NOT NULL
    OR revert_row.expires_at <= now()
  THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  UPDATE public.email_change_reversions
  SET consumed_at = now()
  WHERE id = revert_row.id;

  PERFORM public.reassign_collaborator_email(revert_row.new_email, revert_row.old_email);

  PERFORM set_config('app.email_change_source', 'revert', true);

  UPDATE auth.users
  SET
    email = revert_row.old_email,
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    email_change = '',
    email_change_token_new = '',
    email_change_token_current = '',
    email_change_sent_at = NULL,
    email_change_confirm_status = 0
  WHERE id = revert_row.user_id;

  UPDATE auth.identities
  SET
    identity_data = identity_data || jsonb_build_object(
      'email', revert_row.old_email,
      'email_verified', true
    ),
    updated_at = now()
  WHERE user_id = revert_row.user_id
    AND provider = 'email';

  DELETE FROM auth.one_time_tokens
  WHERE user_id = revert_row.user_id;

  DELETE FROM auth.sessions
  WHERE user_id = revert_row.user_id;

  RETURN jsonb_build_object(
    'user_id', revert_row.user_id,
    'old_email', revert_row.old_email
  );
END;
$$;
