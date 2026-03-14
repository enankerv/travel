-- ============================================================================
-- Add location columns to getaways for map display (PostGIS)
-- ============================================================================
-- Run after supabase_setup.sql. Idempotent.
-- Keeps lat/lng for simple API use; adds PostGIS geography for spatial queries.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE getaways ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE getaways ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- PostGIS geography column (named 'geo' to avoid conflict with text column 'location')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'getaways' AND column_name = 'geo'
  ) THEN
    ALTER TABLE getaways ADD COLUMN geo geography(POINT, 4326)
      GENERATED ALWAYS AS (
        CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ELSE NULL END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_getaways_geo ON getaways USING GIST(geo) WHERE geo IS NOT NULL;
