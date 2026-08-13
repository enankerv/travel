-- Comment replies: optional self-FK to the parent comment on the same POI.
-- Idempotent: safe to re-run.

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS replying_to UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_replying_to ON public.comments(replying_to);

CREATE OR REPLACE FUNCTION public.comments_replying_to_same_poi()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_poi uuid;
BEGIN
  IF NEW.replying_to IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.replying_to = NEW.id THEN
    RAISE EXCEPTION 'comment cannot reply to itself';
  END IF;
  SELECT poi_id INTO parent_poi FROM public.comments WHERE id = NEW.replying_to;
  IF parent_poi IS NULL THEN
    RAISE EXCEPTION 'parent comment not found';
  END IF;
  IF parent_poi IS DISTINCT FROM NEW.poi_id THEN
    RAISE EXCEPTION 'reply must target a comment on the same poi';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_replying_to_same_poi ON public.comments;
CREATE TRIGGER comments_replying_to_same_poi
  BEFORE INSERT OR UPDATE OF replying_to, poi_id ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_replying_to_same_poi();

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
  user_id_val := COALESCE(NEW.user_id, OLD.user_id);
  SELECT p.list_id INTO list_id_val FROM pois p WHERE p.id = COALESCE(NEW.poi_id, OLD.poi_id);
  IF list_id_val IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT p.first_name, p.avatar_url INTO first_name_val, avatar_url_val
    FROM profiles p WHERE p.id = user_id_val;
    payload := jsonb_build_object(
      'id', NEW.id,
      'list_id', list_id_val,
      'poi_id', NEW.poi_id,
      'user_id', NEW.user_id,
      'body', NEW.body,
      'replying_to', NEW.replying_to,
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
      'poi_id', OLD.poi_id,
      'user_id', OLD.user_id
    );
    msg := jsonb_build_object('old_record', payload);
    PERFORM realtime.send(msg, 'COMMENT_DELETE', 'list:' || list_id_val::text, true);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
