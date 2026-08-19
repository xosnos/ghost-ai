/*
# Email change reversions, collaborator rewrite, and revert helpers

Adds `email_change_reversions` for 7-day hashed revert tokens, a trigger on
`auth.users.email` that rewrites collaborator emails and notifies `account-mailer`,
and SECURITY DEFINER helpers for revert lookup and execution.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.email_change_reversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email text NOT NULL,
  new_email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_change_reversions_token_hash_idx
  ON public.email_change_reversions (token_hash);

CREATE INDEX email_change_reversions_user_id_idx
  ON public.email_change_reversions (user_id);

CREATE UNIQUE INDEX email_change_reversions_open_user_idx
  ON public.email_change_reversions (user_id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.email_change_reversions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_change_reversions FROM anon, authenticated;
GRANT ALL ON public.email_change_reversions TO service_role;

CREATE OR REPLACE FUNCTION public.reassign_collaborator_email(
  old_email text,
  new_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_old text := lower(trim(old_email));
  normalized_new text := lower(trim(new_email));
  collab_row record;
BEGIN
  FOR collab_row IN
    SELECT id, project_id
    FROM public.project_collaborators
    WHERE lower(email) = normalized_old
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.project_collaborators
      WHERE project_id = collab_row.project_id
        AND lower(email) = normalized_new
    ) THEN
      DELETE FROM public.project_collaborators
      WHERE id = collab_row.id;
    ELSE
      UPDATE public.project_collaborators
      SET email = normalized_new
      WHERE id = collab_row.id;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_collaborator_email(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_collaborator_email(text, text)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  raw_token text;
  token_hash_value text;
  expires timestamptz;
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
  );

  PERFORM public.reassign_collaborator_email(OLD.email, NEW.email);

  PERFORM net.http_post(
    url := public.get_vault_secret('account_mailer_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', public.get_vault_secret('automations'),
      'Authorization', 'Bearer ' || public.get_vault_secret('automations')
    ),
    body := jsonb_build_object(
      'user_id', NEW.id,
      'old_email', lower(OLD.email),
      'new_email', lower(NEW.email),
      'raw_token', raw_token,
      'expires_at', expires
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_changed ON auth.users;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_email_change();

CREATE OR REPLACE FUNCTION public.lookup_email_revert(p_token text)
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
  WHERE token_hash = token_hash_value;

  IF NOT FOUND
    OR revert_row.consumed_at IS NOT NULL
    OR revert_row.expires_at <= now()
  THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'old_email', revert_row.old_email,
    'new_email', revert_row.new_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_email_revert(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_email_revert(text)
  TO service_role, postgres;

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
    email_confirmed_at = coalesce(email_confirmed_at, now())
  WHERE id = revert_row.user_id;

  RETURN jsonb_build_object(
    'user_id', revert_row.user_id,
    'old_email', revert_row.old_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_email_revert(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_email_revert(text)
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.delete_collaborator_rows_for_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.project_collaborators
  WHERE lower(email) = lower(trim(p_email));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_collaborator_rows_for_email(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_collaborator_rows_for_email(text)
  TO service_role, postgres;
