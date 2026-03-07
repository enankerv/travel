-- Drop all tables and functions to reset the database
-- Run this in Supabase SQL Editor if you need to start fresh

-- Drop triggers first
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
DROP TRIGGER IF EXISTS update_villas_updated_at ON villas;

-- Drop functions
DROP FUNCTION IF EXISTS update_lists_updated_at();
DROP FUNCTION IF EXISTS update_villas_updated_at();
DROP FUNCTION IF EXISTS increment_invite_token_uses();

-- Drop all policies first
DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can create lists" ON lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;

DROP POLICY IF EXISTS "List creators can view members" ON list_members;
DROP POLICY IF EXISTS "List creators can add members" ON list_members;
DROP POLICY IF EXISTS "List creators can update members" ON list_members;
DROP POLICY IF EXISTS "List creators can remove members" ON list_members;

DROP POLICY IF EXISTS "Users can view villas in their own lists" ON villas;
DROP POLICY IF EXISTS "Users can add villas to their own lists" ON villas;
DROP POLICY IF EXISTS "Users can update villas in their own lists" ON villas;
DROP POLICY IF EXISTS "Users can delete villas from their own lists" ON villas;

DROP POLICY IF EXISTS "Users can view images in their villas" ON villa_images;
DROP POLICY IF EXISTS "Users can add images to their villas" ON villa_images;

DROP POLICY IF EXISTS "List admins can view invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can create invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can manage invite tokens" ON invite_tokens;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS villa_images;
DROP TABLE IF EXISTS invite_tokens;
DROP TABLE IF EXISTS villas;
DROP TABLE IF EXISTS list_members;
DROP TABLE IF EXISTS lists;

-- Verify all tables are dropped
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
