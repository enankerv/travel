-- Supabase Auth Hook: Block signups for emails not in allowed_emails table
-- Run in Supabase SQL Editor, then enable the hook in Dashboard: Authentication > Hooks
--
-- 1. Create allowed_emails table (single source of truth for allowlist)
-- 2. Create before-user-created hook function
-- 3. Grant permissions for supabase_auth_admin to run the hook

-- Table: who can sign up (and use the app)
CREATE TABLE IF NOT EXISTS public.allowed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grant supabase_auth_admin read access (needed for the hook)
GRANT SELECT ON public.allowed_emails TO supabase_auth_admin;

-- Revoke from others (don't expose the list via API)
REVOKE ALL ON public.allowed_emails FROM anon, authenticated, public;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- Hook function: runs before each new user is created
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
  is_allowed BOOLEAN;
BEGIN
  user_email := LOWER(TRIM(event->'user'->>'email'));
  
  -- Phone signups: reject (we only support email allowlist)
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'Email is required to sign up.',
        'http_code', 400
      )
    );
  END IF;

  -- Check if email is in allowlist
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_emails
    WHERE LOWER(TRIM(email)) = user_email
  ) INTO is_allowed;

  IF NOT is_allowed THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'message', 'You''re not on the invite list yet. Ask the owner to add your email.',
        'http_code', 403
      )
    );
  END IF;

  -- Allowed
  RETURN '{}'::jsonb;
END;
$$;

-- Permissions: only supabase_auth_admin can execute (Supabase Auth calls it)
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(JSONB) FROM anon, authenticated, public;

-- Add your first allowed email (replace with your actual email)
-- INSERT INTO public.allowed_emails (email) VALUES ('you@example.com');
