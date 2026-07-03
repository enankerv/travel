-- ============================================================================
-- SCHEMA: POLICIES
-- ============================================================================
-- Helper functions and RLS policies. Every user-facing policy requires
-- user_has_verified_terms_and_age() except profile INSERT/UPDATE (used to set
-- terms_accepted_at and age_verified_at).
-- Run after schema_tables.sql.
-- Idempotent: safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- terms + age gate (TERMS_CUTOFF = 2026-03-18; bump when you update Terms/Privacy)
CREATE OR REPLACE FUNCTION public.user_has_verified_terms_and_age()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.terms_accepted_at IS NOT NULL
        AND p.age_verified_at   IS NOT NULL
        AND p.terms_accepted_at >= '2026-03-18T00:00:00+00'::timestamptz
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
-- 2. RLS POLICIES
-- ============================================================================

-- Profiles -------------------------------------------------------------------
-- INSERT/UPDATE: no terms check (user sets terms_accepted_at / age_verified_at)
-- SELECT: own profile allowed without terms; list-mates require terms

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

-- Points of interest ---------------------------------------------------------

DROP POLICY IF EXISTS "Users can view pois in their lists" ON pois;
CREATE POLICY "Users can view pois in their lists"
  ON pois FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can add pois to lists they have access to" ON pois;
CREATE POLICY "Users can add pois to lists they have access to"
  ON pois FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update pois in lists they have access to" ON pois;
CREATE POLICY "Users can update pois in lists they have access to"
  ON pois FOR UPDATE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Editors can delete pois from lists" ON pois;
CREATE POLICY "Editors can delete pois from lists"
  ON pois FOR DELETE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

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

-- Comments -------------------------------------------------------------------

DROP POLICY IF EXISTS "List members can read comments" ON comments;
CREATE POLICY "List members can read comments"
  ON comments FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND is_list_owner_or_member(comments.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "List members can add own comment" ON comments;
CREATE POLICY "List members can add own comment"
  ON comments FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND user_id = auth.uid()
    AND is_list_owner_or_member(list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Comment owner can update" ON comments;
CREATE POLICY "Comment owner can update"
  ON comments FOR UPDATE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Comment owner can delete" ON comments;
CREATE POLICY "Comment owner can delete"
  ON comments FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Votes ----------------------------------------------------------------------

DROP POLICY IF EXISTS "List members can read votes" ON votes;
CREATE POLICY "List members can read votes"
  ON votes FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND is_list_owner_or_member(votes.list_id, auth.uid())
  );

DROP POLICY IF EXISTS "List members can add own vote" ON votes;
CREATE POLICY "List members can add own vote"
  ON votes FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND user_id = auth.uid()
    AND is_list_owner_or_member(list_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can remove own vote" ON votes;
CREATE POLICY "Users can remove own vote"
  ON votes FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Scout credits --------------------------------------------------------------
-- Users can only read their own balance; must have accepted terms

DROP POLICY IF EXISTS "Users can read own scout credits" ON scout_credits;
CREATE POLICY "Users can read own scout credits"
  ON scout_credits FOR SELECT TO authenticated
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Storage: getaway-images bucket ---------------------------------------------

DROP POLICY IF EXISTS "Allow getaway image uploads" ON storage.objects;
CREATE POLICY "Allow getaway image uploads" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND (bucket_id = 'getaway-images')
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
    user_has_verified_terms_and_age()
    AND (bucket_id = 'getaway-images')
    AND EXISTS (
      SELECT 1 FROM getaways g
      WHERE (g.id)::text = (storage.foldername(objects.name))[1]
      AND (
        EXISTS (SELECT 1 FROM lists l WHERE (l.id = g.list_id) AND (l.user_id = auth.uid()))
        OR EXISTS (SELECT 1 FROM list_members lm WHERE (lm.list_id = g.list_id) AND (lm.user_id = auth.uid()))
      )
    )
  );

-- Legacy bucket: villa-images SELECT only ------------------------------------

DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;
DROP POLICY IF EXISTS "List members can view legacy villa-images" ON storage.objects;
CREATE POLICY "List members can view legacy villa-images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    user_has_verified_terms_and_age()
    AND (bucket_id = 'villa-images')
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
    user_has_verified_terms_and_age()
    AND topic LIKE 'list:%'
    AND public.is_list_owner_or_member((split_part(topic, ':', 2))::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "list_members_can_send" ON realtime.messages;
CREATE POLICY "list_members_can_send" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND topic LIKE 'list:%'
    AND public.is_list_owner_or_member((split_part(topic, ':', 2))::uuid, auth.uid())
  );
