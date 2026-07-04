-- ============================================================================
-- MIGRATION: getaways → pois (spine) + getaways (accommodation subtype)
-- ============================================================================
-- Introduces a `pois` spine table shared by every board pin and recasts
-- `getaways` as a 1:1 subtype keyed by poi_id. Getaway ids are preserved as
-- poi ids, so every existing foreign key (images, votes, comments, storage
-- object paths) keeps pointing at the same uuid.
--
-- Run this ONCE in the Supabase SQL Editor. Back up first
-- (Dashboard → Database → Backups).
--
-- AFTER this migration, re-run (both are idempotent):
--   1. db/schema_tables.sql    -- installs pois indexes, triggers, realtime
--   2. db/schema_policies.sql  -- installs pois/poi_images RLS + storage policies
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Guard: abort if already migrated (getaways no longer has `name`)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'getaways' AND column_name = 'name'
  ) THEN
    RAISE EXCEPTION 'getaways already migrated to the POI spine (no `name` column); aborting.';
  END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- 1. Drop obsolete getaway-shaped triggers/functions before reshaping
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_getaways_updated_at ON getaways;
DROP TRIGGER IF EXISTS getaways_broadcast_list_trigger ON public.getaways;
DROP TRIGGER IF EXISTS getaway_images_broadcast_trigger ON public.getaway_images;
DROP FUNCTION IF EXISTS public.getaway_images_broadcast_trigger();
DROP FUNCTION IF EXISTS public._getaway_with_images(record);
DROP FUNCTION IF EXISTS public.update_getaways_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Create the pois spine
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS pois (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  poi_type TEXT NOT NULL DEFAULT 'getaway'
    CHECK (poi_type IN ('getaway', 'activity', 'restaurant', 'flight', 'note', 'poi')),

  title TEXT,
  description TEXT,

  location TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geo geography(POINT, 4326) GENERATED ALWAYS AS (
    CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ELSE NULL END
  ) STORED,

  source_url TEXT,
  thumbnail_url TEXT,

  board_x DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  board_y DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  board_z INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pois_list_id ON pois(list_id);
CREATE INDEX IF NOT EXISTS idx_pois_user_id ON pois(user_id);
CREATE INDEX IF NOT EXISTS idx_pois_poi_type ON pois(poi_type);
CREATE INDEX IF NOT EXISTS idx_pois_created_at ON pois(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pois_geo ON pois USING GIST(geo) WHERE geo IS NOT NULL;

ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. Backfill pois from getaways (id preserved → poi id == getaway id)
-- ----------------------------------------------------------------------------

INSERT INTO pois (
  id, list_id, user_id, poi_type,
  title, description, location, source_url,
  lat, lng, created_at, updated_at
)
SELECT
  g.id, g.list_id, g.user_id, 'getaway',
  g.name, g.description, g.location, g.source_url,
  g.lat, g.lng, COALESCE(g.created_at, NOW()), COALESCE(g.updated_at, NOW())
FROM getaways g
WHERE NOT EXISTS (SELECT 1 FROM pois p WHERE p.id = g.id);

-- ----------------------------------------------------------------------------
-- 4. Re-point getaway_images → poi_images (poi_id == old getaway_id)
-- ----------------------------------------------------------------------------

ALTER TABLE getaway_images DROP CONSTRAINT IF EXISTS getaway_images_getaway_id_fkey;
ALTER TABLE getaway_images RENAME COLUMN getaway_id TO poi_id;
ALTER TABLE getaway_images
  ADD CONSTRAINT poi_images_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE;
ALTER TABLE getaway_images RENAME TO poi_images;
ALTER INDEX IF EXISTS idx_getaway_images_getaway_id RENAME TO idx_poi_images_poi_id;

-- Seed pois.thumbnail_url with the first image (by position) for each poi
UPDATE pois p
SET thumbnail_url = sub.image_url
FROM (
  SELECT DISTINCT ON (poi_id) poi_id, image_url
  FROM poi_images
  ORDER BY poi_id, position, created_at
) sub
WHERE sub.poi_id = p.id AND p.thumbnail_url IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Re-point votes.getaway_id → votes.poi_id (list_id dropped; poi determines it)
-- ----------------------------------------------------------------------------

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_getaway_id_fkey;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_list_id_getaway_id_user_id_key;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_list_id_fkey;
ALTER TABLE votes RENAME COLUMN getaway_id TO poi_id;
ALTER TABLE votes
  ADD CONSTRAINT votes_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE;
ALTER TABLE votes
  ADD CONSTRAINT votes_poi_id_user_id_key UNIQUE (poi_id, user_id);
ALTER INDEX IF EXISTS idx_votes_getaway_id RENAME TO idx_votes_poi_id;
DROP INDEX IF EXISTS idx_votes_list_id;
DROP INDEX IF EXISTS idx_votes_list_getaway;
ALTER TABLE votes DROP COLUMN IF EXISTS list_id;

-- ----------------------------------------------------------------------------
-- 6. Re-point comments.getaway_id → comments.poi_id (list_id dropped)
-- ----------------------------------------------------------------------------

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_getaway_id_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_list_id_fkey;
ALTER TABLE comments RENAME COLUMN getaway_id TO poi_id;
ALTER TABLE comments
  ADD CONSTRAINT comments_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE;
ALTER INDEX IF EXISTS idx_comments_getaway_id RENAME TO idx_comments_poi_id;
DROP INDEX IF EXISTS idx_comments_list_id;
DROP INDEX IF EXISTS idx_comments_list_getaway;
ALTER TABLE comments DROP COLUMN IF EXISTS list_id;

-- ----------------------------------------------------------------------------
-- 7. Reshape getaways into the accommodation subtype (id → poi_id PK)
-- ----------------------------------------------------------------------------

ALTER TABLE getaways DROP CONSTRAINT IF EXISTS getaways_pkey;
ALTER TABLE getaways RENAME COLUMN id TO poi_id;
ALTER TABLE getaways ALTER COLUMN poi_id DROP DEFAULT;
ALTER TABLE getaways ADD PRIMARY KEY (poi_id);
ALTER TABLE getaways
  ADD CONSTRAINT getaways_poi_id_fkey FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE;

-- Drop columns that now live on pois (geo depends on lat/lng, so drop it first).
-- slug and list_id are gone too: a getaway is addressed by its poi_id.
ALTER TABLE getaways DROP CONSTRAINT IF EXISTS getaways_list_id_slug_key;
DROP INDEX IF EXISTS idx_getaways_list_id;
ALTER TABLE getaways DROP COLUMN IF EXISTS geo;
ALTER TABLE getaways DROP COLUMN IF EXISTS lat;
ALTER TABLE getaways DROP COLUMN IF EXISTS lng;
ALTER TABLE getaways DROP COLUMN IF EXISTS user_id;
ALTER TABLE getaways DROP COLUMN IF EXISTS name;
ALTER TABLE getaways DROP COLUMN IF EXISTS location;
ALTER TABLE getaways DROP COLUMN IF EXISTS description;
ALTER TABLE getaways DROP COLUMN IF EXISTS source_url;
ALTER TABLE getaways DROP COLUMN IF EXISTS slug;
ALTER TABLE getaways DROP COLUMN IF EXISTS list_id;
ALTER TABLE getaways DROP COLUMN IF EXISTS created_at;
ALTER TABLE getaways DROP COLUMN IF EXISTS updated_at;

-- ----------------------------------------------------------------------------
-- 8. Realtime: broadcast pois + poi_images; getaways no longer published direct
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'getaways'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE getaways;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pois'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pois;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'poi_images'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE poi_images;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- AFTER MIGRATION — re-run to (re)install triggers, functions and policies:
--   \i db/schema_tables.sql
--   \i db/schema_policies.sql
-- Then update backend/frontend code to read title/thumbnail_url/board_* from
-- pois and the accommodation fields from getaways (poi_id).
-- ============================================================================
