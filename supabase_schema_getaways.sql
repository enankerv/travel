-- ============================================================================
-- GETAWAYS (consolidated schema – was villas)
-- Trip-planning friendly: one display name, flexible price, merged summaries,
-- no currency/region-specific columns. Images live in getaway_images only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS getaways (
  -- Identity & list
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Source
  source_url TEXT,
  import_status TEXT NOT NULL DEFAULT 'loading'
    CHECK (import_status IN ('loading', 'loaded', 'thin', 'error')),
  import_error TEXT,

  -- Display & place
  name TEXT,
  location TEXT,
  region TEXT,

  -- Capacity (accommodation-style; optional for other trip types)
  bedrooms INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,

  -- Pricing (flexible: any currency, any period)
  price DECIMAL(12, 2),
  price_currency TEXT,
  price_period TEXT,
  price_note TEXT,
  deposit DECIMAL(12, 2),

  -- Features (single lists; pool/extras merged into amenities)
  amenities TEXT[],
  included TEXT[],

  -- Free-form text (merged from interiors/exteriors/location summary + the_catch)
  description TEXT,
  caveats TEXT,

  UNIQUE(list_id, slug)
);

CREATE INDEX idx_getaways_list_id ON getaways(list_id);
CREATE INDEX idx_getaways_user_id ON getaways(user_id);
CREATE INDEX idx_getaways_created_at ON getaways(created_at DESC);
CREATE INDEX idx_getaways_import_status ON getaways(import_status);

ALTER TABLE getaways ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- GETAWAY IMAGES (was villa_images)
-- ============================================================================

CREATE TABLE IF NOT EXISTS getaway_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  getaway_id UUID NOT NULL REFERENCES getaways(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_getaway_images_getaway_id ON getaway_images(getaway_id);

ALTER TABLE getaway_images ENABLE ROW LEVEL SECURITY;
