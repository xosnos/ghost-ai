/*
# Restrict project realtime channels to project members

Realtime topics are private and only authenticated project owners or
collaborators may read or send messages for a project topic.
*/

CREATE OR REPLACE FUNCTION public.project_id_from_realtime_topic(topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE
    WHEN topic ~ '^project:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      THEN substring(topic FROM 9)::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.project_id_from_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_id_from_realtime_topic(text) TO authenticated;

DROP POLICY IF EXISTS "project_members_can_receive_realtime" ON realtime.messages;
CREATE POLICY "project_members_can_receive_realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    public.is_project_owner(public.project_id_from_realtime_topic(realtime.topic()))
    OR public.is_project_collaborator(public.project_id_from_realtime_topic(realtime.topic()))
  );

DROP POLICY IF EXISTS "project_members_can_send_realtime" ON realtime.messages;
CREATE POLICY "project_members_can_send_realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_project_owner(public.project_id_from_realtime_topic(realtime.topic()))
    OR public.is_project_collaborator(public.project_id_from_realtime_topic(realtime.topic()))
  );
