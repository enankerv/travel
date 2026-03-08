-- Add age_verified_at to profiles (run in Supabase SQL Editor)
-- Records when user confirmed they are 16+ at first sign-in

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
