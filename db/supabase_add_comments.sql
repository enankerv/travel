-- ============================================================================
-- Add comments table: per getaway per list, list members can read, owner can edit
-- ============================================================================
-- Run after supabase_setup.sql and supabase_add_votes.sql. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  getaway_id UUID NOT NULL REFERENCES getaways(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_list_id ON comments(list_id);
CREATE INDEX IF NOT EXISTS idx_comments_getaway_id ON comments(getaway_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_list_getaway ON comments(list_id, getaway_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- List members can read all comments in their list
DROP POLICY IF EXISTS "List members can read comments" ON comments;
CREATE POLICY "List members can read comments"
  ON comments FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND is_list_owner_or_member(comments.list_id, auth.uid())
  );

-- List members can insert their own comment (getaway must be in list)
DROP POLICY IF EXISTS "List members can add own comment" ON comments;
CREATE POLICY "List members can add own comment"
  ON comments FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND user_id = auth.uid()
    AND is_list_owner_or_member(list_id, auth.uid())
  );

-- Only comment owner can update their own comment
DROP POLICY IF EXISTS "Comment owner can update" ON comments;
CREATE POLICY "Comment owner can update"
  ON comments FOR UPDATE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only comment owner can delete their own comment
DROP POLICY IF EXISTS "Comment owner can delete" ON comments;
CREATE POLICY "Comment owner can delete"
  ON comments FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_updated_at();

-- Broadcast comment changes to realtime channel list:<list_id>
CREATE OR REPLACE FUNCTION public.comments_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  list_id_val uuid;
  user_id_val uuid;
  first_name_val text;
  avatar_url_val text;
  payload jsonb;
  msg jsonb;
BEGIN
  list_id_val := COALESCE(NEW.list_id, OLD.list_id);
  user_id_val := COALESCE(NEW.user_id, OLD.user_id);

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT p.first_name, p.avatar_url INTO first_name_val, avatar_url_val
    FROM profiles p WHERE p.id = user_id_val;
    payload := jsonb_build_object(
      'id', NEW.id,
      'list_id', NEW.list_id,
      'getaway_id', NEW.getaway_id,
      'user_id', NEW.user_id,
      'body', NEW.body,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at,
      'first_name', COALESCE(first_name_val, ''),
      'avatar_url', COALESCE(avatar_url_val, '')
    );
    msg := jsonb_build_object('record', payload);
    IF TG_OP = 'INSERT' THEN
      PERFORM realtime.send(msg, 'COMMENT_INSERT', 'list:' || list_id_val::text, true);
    ELSE
      PERFORM realtime.send(msg, 'COMMENT_UPDATE', 'list:' || list_id_val::text, true);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'id', OLD.id,
      'getaway_id', OLD.getaway_id,
      'user_id', OLD.user_id
    );
    msg := jsonb_build_object('old_record', payload);
    PERFORM realtime.send(msg, 'COMMENT_DELETE', 'list:' || list_id_val::text, true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS comments_broadcast_list_trigger ON public.comments;
CREATE TRIGGER comments_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_broadcast_list_trigger();
