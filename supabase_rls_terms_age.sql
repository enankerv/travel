-- RLS: Require terms_accepted_at and age_verified_at for all data access.
-- Run after supabase_age_verified.sql. Users without both are denied.
-- terms_accepted_at must be >= TERMS_CUTOFF (bump when you update Terms/Privacy; keep in sync with app TERMS_UPDATED_AT).

CREATE OR REPLACE FUNCTION public.user_has_verified_terms_and_age()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (
       p.terms_accepted_at IS NOT NULL
       AND p.age_verified_at IS NOT NULL
       AND p.terms_accepted_at >= '2025-03-07T00:00:00+00'::timestamptz
     )
     FROM profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

-- SECURITY DEFINER to avoid RLS recursion between lists and list_members
CREATE OR REPLACE FUNCTION public.is_list_owner_or_member(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner_or_editor(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id AND role IN ('admin', 'editor'));
$$;

CREATE OR REPLACE FUNCTION public.is_list_admin(check_list_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM lists WHERE id = check_list_id AND user_id = check_user_id)
     OR EXISTS (SELECT 1 FROM list_members WHERE list_id = check_list_id AND user_id = check_user_id AND role = 'admin');
$$;

-- Profiles: users can always read own profile (to check terms/age status). Others require verification.
DROP POLICY IF EXISTS "Users can view profiles of list-mates" ON public.profiles;
CREATE POLICY "Users can view profiles of list-mates"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (user_has_verified_terms_and_age() AND shares_list_with(auth.uid(), id))
  );

-- Users can always update own profile (so they can set terms_accepted_at and age_verified_at)
-- DROP/CREATE only if policy name differs; keep existing
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Lists: require verification for all operations
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

-- List members: require verification
DROP POLICY IF EXISTS "List creators can view members" ON list_members;
DROP POLICY IF EXISTS "List members can view other members" ON list_members;
DROP POLICY IF EXISTS "Users can view own list membership" ON list_members;
CREATE POLICY "Users can view own list membership"
  ON list_members FOR SELECT
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

CREATE POLICY "List creators can view members"
  ON list_members FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(list_members.list_id, auth.uid()));

DROP POLICY IF EXISTS "List creators can add members" ON list_members;
CREATE POLICY "List creators can add members"
  ON list_members FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "List creators can update members" ON list_members;
CREATE POLICY "List creators can update members"
  ON list_members FOR UPDATE
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "List creators can remove members" ON list_members;
CREATE POLICY "List creators can remove members"
  ON list_members FOR DELETE
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id AND lists.user_id = auth.uid()
    )
  );

-- Allow users to remove themselves (leave list)
DROP POLICY IF EXISTS "Users can remove themselves from a list" ON list_members;
CREATE POLICY "Users can remove themselves from a list"
  ON list_members FOR DELETE
  USING (user_has_verified_terms_and_age() AND user_id = auth.uid());

-- Villas: require verification (use SECURITY DEFINER helpers to avoid recursion)
DROP POLICY IF EXISTS "Users can view villas in their lists" ON villas;
CREATE POLICY "Users can view villas in their lists"
  ON villas FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(villas.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can add villas to lists they have access to" ON villas;
CREATE POLICY "Users can add villas to lists they have access to"
  ON villas FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND is_list_owner_or_editor(villas.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update villas in lists they have access to" ON villas;
CREATE POLICY "Users can update villas in lists they have access to"
  ON villas FOR UPDATE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(villas.list_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete villas from lists" ON villas;
CREATE POLICY "Admins can delete villas from lists"
  ON villas FOR DELETE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(villas.list_id, auth.uid()));

-- Villa images: require verification (villas/lists bypass RLS via helpers)
DROP POLICY IF EXISTS "Users can view images in their villas" ON villa_images;
CREATE POLICY "Users can view images in their villas"
  ON villa_images FOR SELECT
  USING (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM villas v WHERE v.id = villa_images.villa_id AND is_list_owner_or_member(v.list_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can add images to their villas" ON villa_images;
CREATE POLICY "Users can add images to their villas"
  ON villa_images FOR INSERT
  WITH CHECK (
    user_has_verified_terms_and_age()
    AND EXISTS (SELECT 1 FROM villas v WHERE v.id = villa_images.villa_id AND is_list_owner_or_editor(v.list_id, auth.uid()))
  );

-- Invite tokens: require verification
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

-- Storage: require verification for villa image access
DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
CREATE POLICY "Allow villa image uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  user_has_verified_terms_and_age()
  AND bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM villas v
    WHERE v.id::text = (storage.foldername(name))[1]
    AND is_list_owner_or_member(v.list_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;
CREATE POLICY "List members can view villa images" ON storage.objects
FOR SELECT TO authenticated
USING (
  user_has_verified_terms_and_age()
  AND bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM villas v
    WHERE v.id::text = (storage.foldername(name))[1]
    AND is_list_owner_or_member(v.list_id, auth.uid())
  )
);
