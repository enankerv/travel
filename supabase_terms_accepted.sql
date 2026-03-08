-- Add terms_accepted_at to profiles (run in Supabase SQL Editor)
-- Users must agree to Terms and Privacy Policy before using the app

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
