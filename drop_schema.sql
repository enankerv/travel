-- Drop all tables and functions to reset the database
-- Run this in Supabase SQL Editor if you need to start fresh

-- Drop triggers first
DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
DROP TRIGGER IF EXISTS update_getaways_updated_at ON getaways;
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
DROP TRIGGER IF EXISTS update_villas_updated_at ON villas;

-- Drop functions
DROP FUNCTION IF EXISTS public.getaways_broadcast_list_trigger();
DROP FUNCTION IF EXISTS update_getaways_updated_at();
DROP FUNCTION IF EXISTS update_lists_updated_at();
DROP FUNCTION IF EXISTS update_villas_updated_at();
DROP FUNCTION IF EXISTS increment_invite_token_uses();

-- Drop all policies first (getaways)
DROP POLICY IF EXISTS "Users can view getaways in their lists" ON getaways;
DROP POLICY IF EXISTS "Users can add getaways to lists they have access to" ON getaways;
DROP POLICY IF EXISTS "Users can update getaways in lists they have access to" ON getaways;
DROP POLICY IF EXISTS "Admins can delete getaways from lists" ON getaways;

DROP POLICY IF EXISTS "Users can view images in their getaways" ON getaway_images;
DROP POLICY IF EXISTS "Users can add images to their getaways" ON getaway_images;

DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can view lists they own or are members of" ON lists;
DROP POLICY IF EXISTS "Users can create lists" ON lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;

DROP POLICY IF EXISTS "List creators can view members" ON list_members;
DROP POLICY IF EXISTS "List members can view other members" ON list_members;
DROP POLICY IF EXISTS "Users can view own list membership" ON list_members;
DROP POLICY IF EXISTS "List creators can add members" ON list_members;
DROP POLICY IF EXISTS "List creators can update members" ON list_members;
DROP POLICY IF EXISTS "List creators can remove members" ON list_members;
DROP POLICY IF EXISTS "Users can remove themselves from a list" ON list_members;

DROP POLICY IF EXISTS "List admins can view invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can create invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can manage invite tokens" ON invite_tokens;

-- Drop storage policies (getaway-images + legacy villa-images)
DROP POLICY IF EXISTS "Allow getaway image uploads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view getaway images" ON storage.objects;
DROP POLICY IF EXISTS "List members can view legacy villa-images" ON storage.objects;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS getaway_images;
DROP TABLE IF EXISTS getaways;
DROP TABLE IF EXISTS invite_tokens;
DROP TABLE IF EXISTS list_members;
DROP TABLE IF EXISTS lists;

-- Verify all tables are dropped
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
