-- ============================================================================
-- Scout quota: credits only (5 free on first use, no monthly reset)
-- ============================================================================
-- Run after supabase_setup.sql
-- Requires SUPABASE_SERVICE_ROLE_KEY in backend for writes.
-- Users can read their own scout_credits balance (for UI).
-- ============================================================================

-- Drop old usage-based objects if migrating from previous version
DROP FUNCTION IF EXISTS public.increment_scout_usage(uuid, text);
DROP FUNCTION IF EXISTS public.decrement_scout_credits(uuid);
DROP TABLE IF EXISTS public.scout_usage;

-- Scout credits: balance = free (5 initial) + purchased
CREATE TABLE IF NOT EXISTS public.scout_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scout_credits_user_id ON scout_credits(user_id);

ALTER TABLE scout_credits ENABLE ROW LEVEL SECURITY;

-- Users can read their own balance only
DROP POLICY IF EXISTS "Users can read own scout credits" ON scout_credits;
CREATE POLICY "Users can read own scout credits"
  ON scout_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE for authenticated; service role handles those

-- ============================================================================
-- RPC: use one scout credit. Gives new users 5 on first use.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.use_scout_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  -- New users: ensure row with 5 credits
  INSERT INTO scout_credits (user_id, balance)
  VALUES (p_user_id, 5)
  ON CONFLICT (user_id) DO NOTHING;

  -- Consume one credit
  UPDATE scout_credits
  SET balance = balance - 1, updated_at = NOW()
  WHERE user_id = p_user_id AND balance > 0;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated = 1;
END;
$$;

-- Remove scout_credits from realtime (no longer using realtime for credits)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'scout_credits'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE scout_credits;
  END IF;
END $$;
