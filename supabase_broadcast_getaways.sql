-- Broadcast getaway changes via realtime.broadcast_changes (Supabase Broadcast from Database)
-- Requires Supabase Realtime with broadcast_changes support (Public Beta).
-- Client must listen for 'broadcast' events (INSERT/UPDATE/DELETE), not postgres_changes.
-- (Migration also creates this trigger; use this file for standalone setup.)

-- 1) Create trigger function to broadcast changes to list:<list_id>
CREATE OR REPLACE FUNCTION public.getaways_broadcast_list_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'list:' || COALESCE(NEW.list_id, OLD.list_id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Create AFTER trigger on public.getaways
DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
CREATE TRIGGER getaways_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.getaways
  FOR EACH ROW EXECUTE FUNCTION public.getaways_broadcast_list_trigger();

-- 3) Ensure indexes for performance (idempotent)
CREATE INDEX IF NOT EXISTS idx_getaways_list_id ON public.getaways(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_list_user ON public.list_members(list_id, user_id);

-- 4) RLS policies on realtime.messages
-- Use is_list_owner_or_member (SECURITY DEFINER) to avoid RLS recursion with list_members/lists.

DROP POLICY IF EXISTS "list_members_can_receive" ON realtime.messages;
CREATE POLICY "list_members_can_receive" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    topic LIKE 'list:%'
    AND public.is_list_owner_or_member((split_part(topic, ':', 2))::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "list_members_can_send" ON realtime.messages;
CREATE POLICY "list_members_can_send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    topic LIKE 'list:%'
    AND public.is_list_owner_or_member((split_part(topic, ':', 2))::uuid, auth.uid())
  );
