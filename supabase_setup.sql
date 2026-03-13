-- ============================================================================
-- SUPABASE SETUP — single source of truth
-- ============================================================================
-- Idempotent: safe to re-run. Uses IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS so nothing breaks on repeat execution.
--
-- Run order on a FRESH project:
--   1. Run this file
--   2. Enable auth hook in Dashboard → Authentication → Hooks
--      (point "Before user created" at public.hook_before_user_created)
--   3. Add allowed emails:
--      INSERT INTO allowed_emails (email) VALUES ('you@example.com');
--
-- If migrating from villas → getaways, run supabase_migrate_villas_to_getaways.sql
-- INSTEAD of this file — it handles the data move and ends in the same state.
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

-- Storage bucket -------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('getaway-images', 'getaway-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- ============================================================================
-- 3. HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS to avoid recursion)
-- ============================================================================

-- terms + age gate (TERMS_CUTOFF = 2025-03-07; bump when you update Terms/Privacy)
CREATE OR REPLACE FUNCTION public.user_has_verified_terms_and_age()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.terms_accepted_at IS NOT NULL
        AND p.age_verified_at   IS NOT NULL
        AND p.terms_accepted_at >= '2025-03-07T00:00:00+00'::timestamptz
     FROM profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

-- profile visibility: do viewer and profile_id share at least one list?
CREATE OR REPLACE FUNCTION public.shares_list_with(viewer_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lists l
    WHERE (l.user_id = viewer_id
           OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = l.id AND lm.user_id = viewer_id))
      AND (l.user_id = profile_id
           OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = l.id AND lm.user_id = profile_id))
  );
$$;

-- list access helpers
CREATE OR REPLACE FUNCTION public.is_list_owner_or_member(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner_or_editor(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id AND role IN ('admin', 'editor'));
$$;

CREATE OR REPLACE FUNCTION public.is_list_admin(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_list_member(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id);
$$;

-- storage upload: resolves getaway → list ownership inside SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.can_upload_getaway_image(object_path text, check_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM getaways g
    JOIN lists l ON l.id = g.list_id
    WHERE g.id::text = split_part(object_path, '/', 1)
      AND (l.user_id = check_user_id
           OR EXISTS (
             SELECT 1 FROM list_members lm
             WHERE lm.list_id = g.list_id AND lm.user_id = check_user_id AND lm.role IN ('admin', 'editor')
           ))
  );
$$;


-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Profiles -------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of list-mates" ON public.profiles;
CREATE POLICY "Users can view profiles of list-mates"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (user_has_verified_terms_and_age() AND shares_list_with(auth.uid(), id))
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Lists ----------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can view lists they own or are members of" ON lists;
CREATE POLICY "Users can view lists they own or are members of"
  ON lists FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(lists.id, auth.uid()));

DROP POLICY IF EXISTS "Users can create lists" ON lists;
CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
CREATE POLICY "Users can update their own lists"
  ON lists FOR UPDATE
  USING (user_has_verified_terms_and_age() AND auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;
CREATE POLICY "Users can delete their own lists"
  ON lists FOR DELETE
  USING (user_has_verified_terms_and_age() AND auth.uid() = user_id);

-- List members ---------------------------------------------------------------

DROP POLICY IF EXISTS "List creators can view members" ON list_members;
DROP POLICY IF EXISTS "List members can view other members" ON list_members;
DROP POLICY IF EXISTS "Users can view own list membership" ON list_members;
CREATE POLICY "Users can view own list membership"
  ON list_members FOR SELECT
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

CREATE POLICY "List members can view other members"
  ON list_members FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(list_members.list_id, auth.uid()));

DROP POLICY IF EXISTS "List creators can add members" ON list_members;
CREATE POLICY "List creators can add members"
  ON list_members FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM lists WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "List creators can update members" ON list_members;
CREATE POLICY "List creators can update members"
  ON list_members FOR UPDATE
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM lists WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "List creators can remove members" ON list_members;
CREATE POLICY "List creators can remove members"
  ON list_members FOR DELETE
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM lists WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can remove themselves from a list" ON list_members;
CREATE POLICY "Users can remove themselves from a list"
  ON list_members FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Getaways -------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view getaways in their lists" ON getaways;
CREATE POLICY "Users can view getaways in their lists"
  ON getaways FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(getaways.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can add getaways to lists they have access to" ON getaways;
CREATE POLICY "Users can add getaways to lists they have access to"
  ON getaways FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND is_list_owner_or_editor(getaways.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update getaways in lists they have access to" ON getaways;
CREATE POLICY "Users can update getaways in lists they have access to"
  ON getaways FOR UPDATE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(getaways.list_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete getaways from lists" ON getaways;
DROP POLICY IF EXISTS "Editors can delete getaways from lists" ON getaways;
CREATE POLICY "Editors can delete getaways from lists"
  ON getaways FOR DELETE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(getaways.list_id, auth.uid()));

-- Getaway images -------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view images in their getaways" ON getaway_images;
CREATE POLICY "Users can view images in their getaways"
  ON getaway_images FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM getaways g WHERE g.id = getaway_images.getaway_id AND is_list_owner_or_member(g.list_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can add images to their getaways" ON getaway_images;
CREATE POLICY "Users can add images to their getaways"
  ON getaway_images FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM getaways g WHERE g.id = getaway_images.getaway_id AND is_list_owner_or_editor(g.list_id, auth.uid()))
  );

-- Invite tokens --------------------------------------------------------------

DROP POLICY IF EXISTS "List admins can view invite tokens" ON invite_tokens;
CREATE POLICY "List admins can view invite tokens"
  ON invite_tokens FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_admin(invite_tokens.list_id, auth.uid()));

DROP POLICY IF EXISTS "List admins can create invite tokens" ON invite_tokens;
CREATE POLICY "List admins can create invite tokens"
  ON invite_tokens FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND is_list_admin(invite_tokens.list_id, auth.uid()));

DROP POLICY IF EXISTS "List admins can manage invite tokens" ON invite_tokens;
CREATE POLICY "List admins can manage invite tokens"
  ON invite_tokens FOR UPDATE
  USING (user_has_verified_terms_and_age() AND is_list_admin(invite_tokens.list_id, auth.uid()));

-- Storage: getaway-images bucket ---------------------------------------------
-- Use objects.name (not name) to avoid scope collision with getaways.name

DROP POLICY IF EXISTS "Allow getaway image uploads" ON storage.objects;
CREATE POLICY "Allow getaway image uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    (bucket_id = 'getaway-images')
    AND EXISTS (
      SELECT 1 FROM getaways g
      WHERE (g.id)::text = (storage.foldername(objects.name))[1]
      AND (
        EXISTS (SELECT 1 FROM lists l WHERE (l.id = g.list_id) AND (l.user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM list_members lm WHERE (lm.list_id = g.list_id) AND (lm.user_id = auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "List members can view getaway images" ON storage.objects;
DROP POLICY IF EXISTS "Allow getaway image reads" ON storage.objects;
CREATE POLICY "Allow getaway image reads" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    (bucket_id = 'getaway-images')
    AND EXISTS (
      SELECT 1 FROM getaways g
      WHERE (g.id)::text = (storage.foldername(objects.name))[1]
      AND (
        EXISTS (SELECT 1 FROM lists l WHERE (l.id = g.list_id) AND (l.user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM list_members lm WHERE (lm.list_id = g.list_id) AND (lm.user_id = auth.uid()))
      )
    )
  );

-- Legacy bucket: villa-images SELECT only (existing objects, same UUIDs) -----

DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;
DROP POLICY IF EXISTS "List members can view legacy villa-images" ON storage.objects;
CREATE POLICY "List members can view legacy villa-images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    (bucket_id = 'villa-images')
    AND EXISTS (
      SELECT 1 FROM getaways g
      WHERE (g.id)::text = (storage.foldername(objects.name))[1]
      AND (
        EXISTS (SELECT 1 FROM lists l WHERE (l.id = g.list_id) AND (l.user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM list_members lm WHERE (lm.list_id = g.list_id) AND (lm.user_id = auth.uid()))
      )
    )
  );

-- Realtime messages ----------------------------------------------------------

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


-- ============================================================================
-- 5. TRIGGERS
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

CREATE OR REPLACE FUNCTION public.getaways_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'list:' || COALESCE(NEW.list_id, OLD.list_id)::text,
    TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
CREATE TRIGGER getaways_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.getaways
  FOR EACH ROW EXECUTE FUNCTION public.getaways_broadcast_list_trigger();


-- ============================================================================
-- 6. REALTIME
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


-- ============================================================================
-- 7. RPCs
-- ============================================================================

-- Create list (bypasses RLS; uses auth.uid() from JWT) -----------------------

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

-- Invite lookup (SECURITY DEFINER so invitee can read before joining) --------

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

-- Accept invite (adds user to list, increments uses) -------------------------

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


-- ============================================================================
-- 8. AUTH HOOK (enable in Dashboard → Authentication → Hooks)
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
