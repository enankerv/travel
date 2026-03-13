-- ============================================================================
-- DROP EVERYTHING — reset to a clean Supabase project
-- ============================================================================
-- Run in Supabase SQL Editor. Drops in dependency order.
-- Does NOT drop auth.users, storage buckets, or the allowed_emails table.
-- Re-run supabase_setup.sql to recreate.

-- Triggers -------------------------------------------------------------------

DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
DROP TRIGGER IF EXISTS update_getaways_updated_at ON getaways;
DROP TRIGGER IF EXISTS update_lists_updated_at ON lists;
DROP TRIGGER IF EXISTS on_list_created_add_creator ON lists;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Realtime policies ----------------------------------------------------------

DROP POLICY IF EXISTS "list_members_can_receive" ON realtime.messages;
DROP POLICY IF EXISTS "list_members_can_send" ON realtime.messages;

-- Storage policies -----------------------------------------------------------

DROP POLICY IF EXISTS "Allow getaway image uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow getaway image reads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view getaway images" ON storage.objects;
DROP POLICY IF EXISTS "List members can view legacy villa-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;

-- Getaway policies -----------------------------------------------------------

DROP POLICY IF EXISTS "Users can view getaways in their lists" ON getaways;
DROP POLICY IF EXISTS "Users can add getaways to lists they have access to" ON getaways;
DROP POLICY IF EXISTS "Users can update getaways in lists they have access to" ON getaways;
DROP POLICY IF EXISTS "Editors can delete getaways from lists" ON getaways;
DROP POLICY IF EXISTS "Admins can delete getaways from lists" ON getaways;

DROP POLICY IF EXISTS "Users can view images in their getaways" ON getaway_images;
DROP POLICY IF EXISTS "Users can add images to their getaways" ON getaway_images;

-- List policies --------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
DROP POLICY IF EXISTS "Users can view lists they own or are members of" ON lists;
DROP POLICY IF EXISTS "Users can create lists" ON lists;
DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;

-- List member policies -------------------------------------------------------

DROP POLICY IF EXISTS "List members can view other members" ON list_members;
DROP POLICY IF EXISTS "List creators can view members" ON list_members;
DROP POLICY IF EXISTS "Users can view own list membership" ON list_members;
DROP POLICY IF EXISTS "List creators can add members" ON list_members;
DROP POLICY IF EXISTS "List creators can update members" ON list_members;
DROP POLICY IF EXISTS "List creators can remove members" ON list_members;
DROP POLICY IF EXISTS "Users can remove themselves from a list" ON list_members;

-- Invite token policies ------------------------------------------------------

DROP POLICY IF EXISTS "List admins can view invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can create invite tokens" ON invite_tokens;
DROP POLICY IF EXISTS "List admins can manage invite tokens" ON invite_tokens;

-- Profile policies -----------------------------------------------------------

DROP POLICY IF EXISTS "Users can view profiles of list-mates" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Tables (reverse dependency order) ------------------------------------------

DROP TABLE IF EXISTS getaway_images;
DROP TABLE IF EXISTS getaways;
DROP TABLE IF EXISTS invite_tokens;
DROP TABLE IF EXISTS list_members;
DROP TABLE IF EXISTS lists;
DROP TABLE IF EXISTS public.profiles;

-- Functions ------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.getaways_broadcast_list_trigger();
DROP FUNCTION IF EXISTS public.update_getaways_updated_at();
DROP FUNCTION IF EXISTS public.update_lists_updated_at();
DROP FUNCTION IF EXISTS public.add_creator_as_member();
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public._first_from_meta(jsonb, text);
DROP FUNCTION IF EXISTS public.user_has_verified_terms_and_age();
DROP FUNCTION IF EXISTS public.shares_list_with(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_owner_or_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_owner_or_editor(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_list_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.can_upload_getaway_image(text, uuid);
DROP FUNCTION IF EXISTS public.can_view_list(uuid);
DROP FUNCTION IF EXISTS public.create_list_rpc(text, text);
DROP FUNCTION IF EXISTS public.get_invite_for_accept(text);
DROP FUNCTION IF EXISTS public.accept_invite_rpc(text, uuid);
DROP FUNCTION IF EXISTS public.hook_before_user_created(jsonb);

-- Legacy (safe to run even if already gone) ----------------------------------

DROP FUNCTION IF EXISTS public.villas_broadcast_list_trigger();
DROP FUNCTION IF EXISTS public.update_villas_updated_at();
DROP FUNCTION IF EXISTS public.increment_invite_token_uses();

-- Verify
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
