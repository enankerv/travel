-- Create villa-images bucket for Supabase Storage (PRIVATE - list members only)
-- Run in Supabase SQL Editor, or create via Dashboard: Storage → New bucket
--
-- Uses user auth token (no service role). RLS policies below.
--
-- Cleanup: remove policy that causes lists↔list_members recursion (500 errors)
DROP POLICY IF EXISTS "Users can view lists they are members of" ON lists;

-- Prerequisite: list_members must allow users to see their own membership
-- (storage policy uses list_members to verify membership without touching lists)
DROP POLICY IF EXISTS "Users can view own list membership" ON list_members;
CREATE POLICY "Users can view own list membership" ON list_members
FOR SELECT USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('villa-images', 'villa-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Allow uploads only for list members (path = villa_id/filename; first folder = villa_id)
DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
CREATE POLICY "Allow villa image uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM villas v
    WHERE v.id::text = (storage.foldername(name))[1]
    AND (
      EXISTS (SELECT 1 FROM lists l WHERE l.id = v.list_id AND l.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = v.list_id AND lm.user_id = auth.uid())
    )
  )
);

-- Allow SELECT only for users who can access the villa's list
-- Path format: {villa_id}/{filename} - first folder = villa_id
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;
CREATE POLICY "List members can view villa images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM villas v
    WHERE v.id::text = (storage.foldername(name))[1]
    AND (
      EXISTS (SELECT 1 FROM lists l WHERE l.id = v.list_id AND l.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = v.list_id AND lm.user_id = auth.uid())
    )
  )
);
