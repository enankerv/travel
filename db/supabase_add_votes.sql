-- ============================================================================
-- Add votes table: users vote once per villa per list (thumbs up)
-- ============================================================================
-- Run after supabase_setup.sql. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  getaway_id UUID NOT NULL REFERENCES getaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, getaway_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_list_id ON votes(list_id);
CREATE INDEX IF NOT EXISTS idx_votes_getaway_id ON votes(getaway_id);
CREATE INDEX IF NOT EXISTS idx_votes_user_id ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_list_getaway ON votes(list_id, getaway_id);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- List members can read all votes in their list
DROP POLICY IF EXISTS "List members can read votes" ON votes;
CREATE POLICY "List members can read votes"
  ON votes FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND is_list_owner_or_member(votes.list_id, auth.uid())
  );

-- Users can only insert their own vote (and must be list member)
DROP POLICY IF EXISTS "List members can add own vote" ON votes;
CREATE POLICY "List members can add own vote"
  ON votes FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND user_id = auth.uid()
    AND is_list_owner_or_member(list_id, auth.uid())
  );

-- Users can only delete their own vote
DROP POLICY IF EXISTS "Users can remove own vote" ON votes;
CREATE POLICY "Users can remove own vote"
  ON votes FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Broadcast vote changes to realtime channel list:<list_id> ---------------------
-- Uses VOTE_INSERT / VOTE_DELETE events so frontend can distinguish from getaway events

CREATE OR REPLACE FUNCTION public.votes_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  list_id_val uuid;
  user_id_val uuid;
  getaway_id_val uuid;
  first_name_val text;
  avatar_url_val text;
  payload jsonb;
  msg jsonb;
BEGIN
  list_id_val := COALESCE(NEW.list_id, OLD.list_id);
  user_id_val := COALESCE(NEW.user_id, OLD.user_id);
  getaway_id_val := COALESCE(NEW.getaway_id, OLD.getaway_id);

  IF TG_OP = 'INSERT' THEN
    SELECT p.first_name, p.avatar_url INTO first_name_val, avatar_url_val
    FROM profiles p WHERE p.id = user_id_val;
    payload := jsonb_build_object(
      'getaway_id', getaway_id_val,
      'user_id', user_id_val,
      'first_name', COALESCE(first_name_val, ''),
      'avatar_url', COALESCE(avatar_url_val, '')
    );
    msg := jsonb_build_object('record', payload);
    PERFORM realtime.send(msg, 'VOTE_INSERT', 'list:' || list_id_val::text, true);
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object('getaway_id', getaway_id_val, 'user_id', user_id_val);
    msg := jsonb_build_object('old_record', payload);
    PERFORM realtime.send(msg, 'VOTE_DELETE', 'list:' || list_id_val::text, true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS votes_broadcast_list_trigger ON public.votes;
CREATE TRIGGER votes_broadcast_list_trigger
  AFTER INSERT OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.votes_broadcast_list_trigger();
