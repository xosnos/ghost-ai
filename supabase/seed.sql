-- Local-development privilege bootstrap.
--
-- Hosted Supabase automatically grants DML on objects in the `public` schema to
-- the `anon`, `authenticated`, and `service_role` roles (via default privileges
-- owned by `supabase_admin`). When migrations are applied by the local CLI those
-- default-privilege grants do not fire, so RLS-protected tables end up with only
-- TRIGGER/REFERENCES/TRUNCATE for these roles and every query fails with
-- "permission denied for table ...".
--
-- This seed restores the grants hosted Supabase provides so the local database
-- behaves the same. It is purely a local-dev convenience: it does not run against
-- the hosted/production project (which already has these grants) and RLS policies
-- remain the actual access-control layer.
--
-- Function EXECUTE is narrower than table DML: anon does not need RPCs, and
-- several SECURITY DEFINER helpers must stay unreachable from browser roles.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to authenticated, service_role;

-- Enforce explicit privilege restrictions for task_runs, project_specs, and pgmq queues
revoke insert, update, delete on public.task_runs from anon, authenticated;
revoke insert, update, delete on public.project_specs from anon, authenticated;
revoke all on schema pgmq from anon, authenticated;
revoke all on schema pgmq_public from public, anon, authenticated;
revoke all on all functions in schema pgmq_public from public, anon, authenticated;
grant usage on schema pgmq_public to service_role, postgres;
grant all on all functions in schema pgmq_public to service_role, postgres;

-- Re-apply function EXECUTE lockdowns the blanket GRANT ALL ON FUNCTIONS would undo
revoke all on function public.get_vault_secret(text) from public, anon, authenticated;
grant execute on function public.get_vault_secret(text) to service_role, postgres;

revoke all on function public.get_cron_job(text) from public, anon, authenticated;
grant execute on function public.get_cron_job(text) to service_role, postgres;

revoke all on function public.enqueue_task_run(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_task_run(uuid, uuid, text, jsonb) to service_role, postgres;

revoke execute on function public.delete_project(uuid) from public, anon;
grant execute on function public.delete_project(uuid) to authenticated;

revoke execute on function public.add_project_collaborator(uuid, text) from public, anon;
grant execute on function public.add_project_collaborator(uuid, text) to authenticated;

revoke execute on function public.remove_project_collaborator(uuid, text) from public, anon;
grant execute on function public.remove_project_collaborator(uuid, text) to authenticated;

revoke execute on function public.get_project_collaborators(uuid) from public, anon;
grant execute on function public.get_project_collaborators(uuid) to authenticated;

revoke execute on function public.is_project_owner(uuid) from public, anon;
grant execute on function public.is_project_owner(uuid) to authenticated;

revoke execute on function public.is_project_collaborator(uuid) from public, anon;
grant execute on function public.is_project_collaborator(uuid) to authenticated;

-- Local Vault values. Hosted projects must set unique secrets; this file does not run there.
-- AUTOMATION_SECRET in .env.local / supabase/functions/.env must match `automations`.
do $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'automations';
  if v_id is null then
    perform vault.create_secret('local-dev-automation-secret', 'automations');
  else
    perform vault.update_secret(v_id, 'local-dev-automation-secret');
  end if;

  select id into v_id from vault.secrets where name = 'ai_worker_url';
  if v_id is null then
    perform vault.create_secret(
      'http://supabase_kong_architype:8000/functions/v1/ai-worker',
      'ai_worker_url'
    );
  else
    perform vault.update_secret(
      v_id,
      'http://supabase_kong_architype:8000/functions/v1/ai-worker'
    );
  end if;
end $$;
