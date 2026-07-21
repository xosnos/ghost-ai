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

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
