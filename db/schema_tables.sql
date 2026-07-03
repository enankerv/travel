-- ============================================================================
-- SCHEMA: TABLES
-- ============================================================================
-- Table definitions, extensions, indexes, storage, triggers, realtime, RPCs.
-- Run this first, then schema_policies.sql.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Auth hook allowlist --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.allowed_emails TO supabase_auth_admin;
REVOKE ALL ON public.allowed_emails FROM anon, authenticated, public;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Profiles -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  avatar_url TEXT,
  terms_accepted_at TIMESTAMPTZ,
  age_verified_at TIMESTAMPTZ,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lists ----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lists_user_id ON lists(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_created_at ON lists(created_at DESC);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- List members ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS list_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_creator BOOLEAN DEFAULT false,
  UNIQUE(list_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_list_members_list_id ON list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_list_members_user_id ON list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_list_members_list_user ON list_members(list_id, user_id);

ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- Getaways -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS getaways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  source_url TEXT,
  import_status TEXT NOT NULL DEFAULT 'loading'
    CHECK (import_status IN ('loading', 'loaded', 'thin', 'error')),
  import_error TEXT,

  name TEXT,
  location TEXT,
  region TEXT,

  bedrooms INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,

  price DECIMAL(12, 2),
  price_currency TEXT,
  price_period TEXT,
  price_note TEXT,
  deposit DECIMAL(12, 2),

  amenities TEXT[],
  included TEXT[],

  description TEXT,
  caveats TEXT,

  UNIQUE(list_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_getaways_list_id ON getaways(list_id);
CREATE INDEX IF NOT EXISTS idx_getaways_user_id ON getaways(user_id);
CREATE INDEX IF NOT EXISTS idx_getaways_created_at ON getaways(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_getaways_import_status ON getaways(import_status);

ALTER TABLE getaways ENABLE ROW LEVEL SECURITY;

-- Getaway images -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS getaway_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  getaway_id UUID NOT NULL REFERENCES getaways(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_getaway_images_getaway_id ON getaway_images(getaway_id);

ALTER TABLE getaway_images ENABLE ROW LEVEL SECURITY;

-- Points of interest (restaurants, activities, places, etc.) -----------------

CREATE TABLE IF NOT EXISTS public.pois (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  slug TEXT NOT NULL,
  poi_type TEXT NOT NULL DEFAULT 'other'
    CHECK (poi_type IN ('restaurant', 'activity', 'business', 'place', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  region TEXT,
  source_url TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_pois_list_id ON pois(list_id);
CREATE INDEX IF NOT EXISTS idx_pois_user_id ON pois(user_id);
CREATE INDEX IF NOT EXISTS idx_pois_poi_type ON pois(poi_type);
CREATE INDEX IF NOT EXISTS idx_pois_created_at ON pois(created_at DESC);

ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Invite tokens --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_list_id ON invite_tokens(list_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Comments -------------------------------------------------------------------

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

-- Votes ----------------------------------------------------------------------

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

-- Scout credits --------------------------------------------------------------

DROP FUNCTION IF EXISTS public.increment_scout_usage(uuid, text);
DROP FUNCTION IF EXISTS public.decrement_scout_credits(uuid);
DROP TABLE IF EXISTS public.scout_usage;

CREATE TABLE IF NOT EXISTS public.scout_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_credits_user_id ON scout_credits(user_id);

ALTER TABLE scout_credits ENABLE ROW LEVEL SECURITY;

-- Storage bucket -------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('getaway-images', 'getaway-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

-- updated_at -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at();

CREATE OR REPLACE FUNCTION update_getaways_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_getaways_updated_at ON getaways;
CREATE TRIGGER update_getaways_updated_at BEFORE UPDATE ON getaways
  FOR EACH ROW EXECUTE FUNCTION update_getaways_updated_at();

CREATE OR REPLACE FUNCTION update_pois_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_pois_updated_at ON pois;
CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON pois
  FOR EACH ROW EXECUTE FUNCTION update_pois_updated_at();

CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_updated_at();

-- Auto-add list creator as admin member --------------------------------------

CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO list_members (list_id, user_id, role, is_creator)
  VALUES (NEW.id, NEW.user_id, 'admin', true)
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_list_created_add_creator ON lists;
CREATE TRIGGER on_list_created_add_creator
  AFTER INSERT ON lists
  FOR EACH ROW EXECUTE PROCEDURE public.add_creator_as_member();

-- Auto-create profile on auth signup ----------------------------------------

CREATE OR REPLACE FUNCTION public._first_from_meta(meta jsonb, fallback_email text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(
    split_part(nullif(trim(meta->>'full_name'), ''), ' ', 1),
    split_part(nullif(trim(fallback_email), ''), '@', 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, avatar_url)
  VALUES (
    NEW.id,
    public._first_from_meta(COALESCE(NEW.raw_user_meta_data, '{}'::jsonb), COALESCE(NEW.email, '')),
    (COALESCE(NEW.raw_user_meta_data, '{}'::jsonb))->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Broadcast getaway changes to realtime channel list:<list_id> ---------------

CREATE OR REPLACE FUNCTION public._getaway_with_images(rec RECORD)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rid uuid;
  imgs jsonb;
BEGIN
  rid := (rec).id;
  SELECT COALESCE(jsonb_agg(gi.image_url ORDER BY gi.position), '[]'::jsonb)
    INTO imgs FROM getaway_images gi WHERE gi.getaway_id = rid;
  RETURN row_to_json(rec)::jsonb || jsonb_build_object('images', imgs);
END;
$$;

CREATE OR REPLACE FUNCTION public.getaways_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_payload jsonb;
  old_payload jsonb;
  msg jsonb;
BEGIN
  new_payload := public._getaway_with_images(COALESCE(NEW, OLD));
  old_payload := CASE WHEN OLD IS NOT NULL THEN public._getaway_with_images(OLD) ELSE NULL END;
  msg := jsonb_build_object('record', new_payload, 'old_record', old_payload);
  PERFORM realtime.send(msg, TG_OP, 'list:' || COALESCE(NEW.list_id, OLD.list_id)::text, true);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
CREATE TRIGGER getaways_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.getaways
  FOR EACH ROW EXECUTE FUNCTION public.getaways_broadcast_list_trigger();

CREATE OR REPLACE FUNCTION public.getaway_images_broadcast_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  g getaways%ROWTYPE;
  payload jsonb;
  msg jsonb;
BEGIN
  SELECT * INTO g FROM getaways WHERE id = COALESCE(NEW.getaway_id, OLD.getaway_id);
  IF FOUND THEN
    payload := public._getaway_with_images(g);
    msg := jsonb_build_object('record', payload, 'old_record', payload);
    PERFORM realtime.send(msg, 'UPDATE', 'list:' || g.list_id::text, true);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS getaway_images_broadcast_trigger ON public.getaway_images;
CREATE TRIGGER getaway_images_broadcast_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.getaway_images
  FOR EACH ROW EXECUTE FUNCTION public.getaway_images_broadcast_trigger();

-- Broadcast POI changes to realtime channel list:<list_id> --------------------

CREATE OR REPLACE FUNCTION public.pois_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payload jsonb;
  msg jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := row_to_json(OLD)::jsonb;
    msg := jsonb_build_object('old_record', payload);
    PERFORM realtime.send(msg, 'POI_DELETE', 'list:' || OLD.list_id::text, true);
  ELSE
    payload := row_to_json(NEW)::jsonb;
    msg := jsonb_build_object('record', payload);
    IF TG_OP = 'INSERT' THEN
      PERFORM realtime.send(msg, 'POI_INSERT', 'list:' || NEW.list_id::text, true);
    ELSE
      PERFORM realtime.send(msg, 'POI_UPDATE', 'list:' || NEW.list_id::text, true);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pois_broadcast_list_trigger ON public.pois;
CREATE TRIGGER pois_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pois
  FOR EACH ROW EXECUTE FUNCTION public.pois_broadcast_list_trigger();

-- Broadcast comment changes ---------------------------------------------------

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

-- Broadcast vote changes ------------------------------------------------------

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


-- ============================================================================
-- 4. REALTIME
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'getaways'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE getaways;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scout_credits'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE scout_credits;
  END IF;
END $$;


-- ============================================================================
-- 5. RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_list_rpc(list_name text, list_description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_row lists%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;
  INSERT INTO lists (user_id, name, description)
  VALUES (auth.uid(), list_name, list_description)
  RETURNING * INTO new_row;
  RETURN to_jsonb(new_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_list_rpc(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invite_for_accept(lookup_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'token', it.token,
    'list_id', it.list_id,
    'list_name', l.name,
    'role', it.role,
    'expires_at', it.expires_at,
    'uses_count', it.uses_count,
    'max_uses', it.max_uses
  ) INTO result
  FROM invite_tokens it
  JOIN lists l ON l.id = it.list_id
  WHERE it.token = lookup_token
    AND it.is_active = true
    AND (it.expires_at IS NULL OR it.expires_at > NOW())
    AND (it.max_uses IS NULL OR it.uses_count < it.max_uses);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invite_rpc(lookup_token text, joining_user_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  tok invite_tokens%ROWTYPE;
  new_member json;
BEGIN
  SELECT * INTO tok
  FROM invite_tokens
  WHERE token = lookup_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;

  INSERT INTO list_members (list_id, user_id, role, invited_by)
  VALUES (tok.list_id, joining_user_id, tok.role, tok.created_by)
  ON CONFLICT (list_id, user_id) DO UPDATE SET role = tok.role, invited_by = tok.created_by
  RETURNING to_json(list_members.*) INTO new_member;

  UPDATE invite_tokens SET uses_count = uses_count + 1 WHERE id = tok.id;

  RETURN json_build_object('ok', true, 'member', new_member);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_for_accept(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite_rpc(text, uuid) TO authenticated;

-- Scout credits: use one credit (service role only; backend calls via service key)
CREATE OR REPLACE FUNCTION public.use_scout_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  INSERT INTO scout_credits (user_id, balance)
  VALUES (p_user_id, 5)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE scout_credits
  SET balance = balance - 1, updated_at = NOW()
  WHERE user_id = p_user_id AND balance > 0;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated = 1;
END;
$$;


-- ============================================================================
-- 6. AUTH HOOK (enable in Dashboard → Authentication → Hooks)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.hook_before_user_created(event JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN;
BEGIN
  user_email := LOWER(TRIM(event->'user'->>'email'));

  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object('message', 'Email is required to sign up.', 'http_code', 400)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE LOWER(TRIM(email)) = user_email
  ) INTO is_allowed;

  IF NOT is_allowed THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object('message', 'You''re not on the invite list yet. Ask the owner to add your email.', 'http_code', 403)
    );
  END IF;

  RETURN '{}'::jsonb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) FROM anon, authenticated, public;
