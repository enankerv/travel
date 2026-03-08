-- Public profiles: minimal data (first_name, avatar_url only, no email)
-- Syncs from auth.users on signup
-- If upgrading from old schema with email/full_name: DROP TABLE IF EXISTS public.profiles;

DROP FUNCTION IF EXISTS public.get_user_profiles(uuid[]);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  avatar_url TEXT,
  terms_accepted_at TIMESTAMPTZ,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- True if viewer and profile_id share at least one list (as creator or member)
CREATE OR REPLACE FUNCTION public.shares_list_with(viewer_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM lists l
    WHERE (
      l.user_id = viewer_id
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = l.id AND lm.user_id = viewer_id)
    )
    AND (
      l.user_id = profile_id
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = l.id AND lm.user_id = profile_id)
    )
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles of list-mates" ON public.profiles;
CREATE POLICY "Users can view profiles of list-mates"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR shares_list_with(auth.uid(), id));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (fallback if trigger missed)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Extract first name: "John Doe" -> "John", "john@email.com" -> "john"
CREATE OR REPLACE FUNCTION public._first_from_meta(meta jsonb, fallback_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    split_part(nullif(trim(meta->>'full_name'), ''), ' ', 1),
    split_part(nullif(trim(fallback_email), ''), '@', 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

-- Backfill existing users (run once)
-- INSERT INTO public.profiles (id, first_name, avatar_url)
-- SELECT id,
--   public._first_from_meta(COALESCE(raw_user_meta_data, '{}'::jsonb), COALESCE(email, '')),
--   (COALESCE(raw_user_meta_data, '{}'::jsonb))->>'avatar_url'
-- FROM auth.users
-- ON CONFLICT (id) DO UPDATE SET
--   first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
--   avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
--   updated_at = NOW();
