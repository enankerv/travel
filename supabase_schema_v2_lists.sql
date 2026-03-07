-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (managed by Supabase Auth, don't create it)
-- Just reference it with auth.users

-- ============================================================================
-- LISTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_lists_user_id ON lists(user_id);
CREATE INDEX idx_lists_created_at ON lists(created_at DESC);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- LIST MEMBERS TABLE (who has access to a list)
-- ============================================================================
CREATE TABLE IF NOT EXISTS list_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, user_id)
);

CREATE INDEX idx_list_members_list_id ON list_members(list_id);
CREATE INDEX idx_list_members_user_id ON list_members(user_id);

ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VILLAS TABLE (updated to belong to lists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS villas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  slug TEXT NOT NULL,
  original_url TEXT,
  scrap_status TEXT NOT NULL DEFAULT 'loading' CHECK (scrap_status IN ('loading', 'loaded', 'thin', 'error')),
  scrap_error TEXT,
  title TEXT,
  villa_name TEXT,
  location TEXT,
  region TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,
  price_weekly_min_eur DECIMAL(10, 2),
  price_weekly_max_eur DECIMAL(10, 2),
  price_weekly_usd DECIMAL(10, 2),
  security_deposit_eur DECIMAL(10, 2),
  pool_features TEXT[],
  amenities TEXT[],
  extras TEXT[],
  included_in_price TEXT[],
  not_included TEXT[],
  interiors_summary TEXT,
  exteriors_summary TEXT,
  location_summary TEXT,
  the_catch TEXT,
  images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(list_id, slug)
);

CREATE INDEX idx_villas_list_id ON villas(list_id);
CREATE INDEX idx_villas_user_id ON villas(user_id);
CREATE INDEX idx_villas_created_at ON villas(created_at DESC);
CREATE INDEX idx_villas_scrap_status ON villas(scrap_status);

ALTER TABLE villas ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- VILLA IMAGES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS villa_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id UUID NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_villa_images_villa_id ON villa_images(villa_id);

ALTER TABLE villa_images ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INVITE TOKENS TABLE (for shareable links)
-- ============================================================================
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER,
  uses_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invite_tokens_list_id ON invite_tokens(list_id);
CREATE INDEX idx_invite_tokens_token ON invite_tokens(token);

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (defined after all tables created)
-- ============================================================================

-- LISTS POLICIES
-- RLS: Users can view lists they own or are members of
-- Note: We use a separate policy for viewing as a member to avoid recursion
CREATE POLICY "Users can view their own lists"
  ON lists FOR SELECT
  USING (
    auth.uid() = user_id
  );

-- Members query lists through list_members table (which has its own RLS)

-- RLS: Only list creator can insert
CREATE POLICY "Users can create lists"
  ON lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS: Only list creator can update
CREATE POLICY "Users can update their own lists"
  ON lists FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: Only list creator can delete
CREATE POLICY "Users can delete their own lists"
  ON lists FOR DELETE
  USING (auth.uid() = user_id);

-- LIST MEMBERS POLICIES
-- RLS: Users can view list members of lists they own (list creator)
CREATE POLICY "List creators can view members"
  ON list_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id
        AND lists.user_id = auth.uid()
    )
  );

-- RLS: Only list creator can add members
CREATE POLICY "List creators can add members"
  ON list_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id
        AND lists.user_id = auth.uid()
    )
  );

-- RLS: Only list creator can update members
CREATE POLICY "List creators can update members"
  ON list_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id
        AND lists.user_id = auth.uid()
    )
  );

-- RLS: Only list creator can remove members
CREATE POLICY "List creators can remove members"
  ON list_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = list_members.list_id
        AND lists.user_id = auth.uid()
    )
  );

-- VILLAS POLICIES
-- RLS: Anyone in a list can view villas in that list
CREATE POLICY "Users can view villas in their lists"
  ON villas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = villas.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
             ))
    )
  );

-- RLS: Anyone with editor+ role can add villas to a list
CREATE POLICY "Users can add villas to lists they have access to"
  ON villas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = villas.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role IN ('admin', 'editor')
             ))
    )
  );

-- RLS: Anyone with editor+ role can update villas in lists they have access to
CREATE POLICY "Users can update villas in lists they have access to"
  ON villas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = villas.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role IN ('admin', 'editor')
             ))
    )
  );

-- RLS: Only admins or list creator can delete villas
CREATE POLICY "Admins can delete villas from lists"
  ON villas FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = villas.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role = 'admin'
             ))
    )
  );

-- VILLA IMAGES POLICIES
-- RLS: Anyone in a list can view images of villas in that list
CREATE POLICY "Users can view images in their villas"
  ON villa_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM villas
      WHERE villas.id = villa_images.villa_id
        AND EXISTS (
          SELECT 1 FROM lists
          WHERE lists.id = villas.list_id
            AND (lists.user_id = auth.uid() OR
                 EXISTS (
                   SELECT 1 FROM list_members
                   WHERE list_members.list_id = lists.id
                     AND list_members.user_id = auth.uid()
                 ))
        )
    )
  );

-- RLS: Anyone with editor+ role can add images to villas in lists they have access to
CREATE POLICY "Users can add images to their villas"
  ON villa_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM villas
      WHERE villas.id = villa_images.villa_id
        AND EXISTS (
          SELECT 1 FROM lists
          WHERE lists.id = villas.list_id
            AND (lists.user_id = auth.uid() OR
                 EXISTS (
                   SELECT 1 FROM list_members
                   WHERE list_members.list_id = lists.id
                     AND list_members.user_id = auth.uid()
                     AND list_members.role IN ('admin', 'editor')
                 ))
        )
    )
  );

-- INVITE TOKENS POLICIES
-- RLS: Only list admins can view/create/manage invite tokens
CREATE POLICY "List admins can view invite tokens"
  ON invite_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = invite_tokens.list_id
        AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List admins can create invite tokens"
  ON invite_tokens FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = invite_tokens.list_id
        AND lists.user_id = auth.uid()
    )
  );

CREATE POLICY "List admins can manage invite tokens"
  ON invite_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = invite_tokens.list_id
        AND lists.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at for lists
CREATE OR REPLACE FUNCTION update_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lists_updated_at BEFORE UPDATE ON lists
  FOR EACH ROW EXECUTE FUNCTION update_lists_updated_at();

-- Update updated_at for villas
CREATE OR REPLACE FUNCTION update_villas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_villas_updated_at BEFORE UPDATE ON villas
  FOR EACH ROW EXECUTE FUNCTION update_villas_updated_at();

-- Increment invite token use count
CREATE OR REPLACE FUNCTION increment_invite_token_uses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invite_tokens
  SET uses_count = uses_count + 1
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ENABLE REALTIME for villas (required for live updates)
-- Dashboard alternative: Database → Replication → supabase_realtime → add villas
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'villas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE villas;
  END IF;
END $$;
