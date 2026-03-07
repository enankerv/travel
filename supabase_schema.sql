-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create villas table
CREATE TABLE IF NOT EXISTS villas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
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
  original_url TEXT,
  images TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Create index on user_id for faster queries
CREATE INDEX idx_villas_user_id ON villas(user_id);
CREATE INDEX idx_villas_created_at ON villas(created_at DESC);

-- Enable Row Level Security
ALTER TABLE villas ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own villas
CREATE POLICY "Users can view their own villas"
  ON villas FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can insert villas for themselves
CREATE POLICY "Users can insert their own villas"
  ON villas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own villas
CREATE POLICY "Users can update their own villas"
  ON villas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own villas
CREATE POLICY "Users can delete their own villas"
  ON villas FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_villas_updated_at BEFORE UPDATE ON villas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create villa_images table for better image management (optional, but recommended)
CREATE TABLE IF NOT EXISTS villa_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  villa_id UUID NOT NULL REFERENCES villas(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_villa_images_villa_id ON villa_images(villa_id);

-- Enable RLS on villa_images
ALTER TABLE villa_images ENABLE ROW LEVEL SECURITY;

-- RLS for villa_images: Users can only see images of their villas
CREATE POLICY "Users can view images of their villas"
  ON villa_images FOR SELECT
  USING (
    villa_id IN (
      SELECT id FROM villas WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert images for their villas"
  ON villa_images FOR INSERT
  WITH CHECK (
    villa_id IN (
      SELECT id FROM villas WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete images from their villas"
  ON villa_images FOR DELETE
  USING (
    villa_id IN (
      SELECT id FROM villas WHERE user_id = auth.uid()
    )
  );
