-- Create villa-images bucket for Supabase Storage (PRIVATE - list members only)
-- Run in Supabase SQL Editor, or create via Dashboard: Storage → New bucket
--
-- Backend needs SUPABASE_SERVICE_ROLE_KEY in .env for uploads (bypasses RLS).
-- Get it from: Supabase Dashboard → Settings → API → service_role (secret)

INSERT INTO storage.buckets (id, name, public)
VALUES ('villa-images', 'villa-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Allow uploads (service_role bypasses RLS; authenticated for user-token uploads)
DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
CREATE POLICY "Allow villa image uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'villa-images');

-- Allow SELECT only for users who can access the villa's list
-- Path format: {villa_id}/{filename} - first folder = villa_id
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;
CREATE POLICY "List members can view villa images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM villas v
    JOIN lists l ON v.list_id = l.id
    WHERE v.id::text = (storage.foldername(name))[1]
    AND (
      l.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM list_members lm
        WHERE lm.list_id = l.id AND lm.user_id = auth.uid()
      )
    )
  )
);
