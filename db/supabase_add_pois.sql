-- ============================================================================
-- Add points of interest (POIs) table for restaurants, activities, places, etc.
-- ============================================================================
-- Run after schema_tables.sql / schema_policies.sql. Idempotent.
-- Generic POI model: type-specific fields live in metadata JSONB until a type
-- graduates to its own table (e.g. hikes with difficulty, duration).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pois (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  poi_type TEXT NOT NULL DEFAULT 'other'
    CHECK (poi_type IN ('restaurant', 'activity', 'business', 'place', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  region TEXT,
  source_url TEXT,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop slug if an earlier version of this migration created it
ALTER TABLE pois DROP COLUMN IF EXISTS slug;

CREATE INDEX IF NOT EXISTS idx_pois_list_id ON pois(list_id);
CREATE INDEX IF NOT EXISTS idx_pois_user_id ON pois(user_id);
CREATE INDEX IF NOT EXISTS idx_pois_poi_type ON pois(poi_type);
CREATE INDEX IF NOT EXISTS idx_pois_created_at ON pois(created_at DESC);

ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- Coordinates (same pattern as getaways)
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE pois ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE pois ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pois' AND column_name = 'geo'
  ) THEN
    ALTER TABLE pois ADD COLUMN geo geography(POINT, 4326)
      GENERATED ALWAYS AS (
        CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ELSE NULL END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pois_geo ON pois USING GIST(geo) WHERE geo IS NOT NULL;

-- RLS policies (mirror getaways)
DROP POLICY IF EXISTS "Users can view pois in their lists" ON pois;
CREATE POLICY "Users can view pois in their lists"
  ON pois FOR SELECT
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_member(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can add pois to lists they have access to" ON pois;
CREATE POLICY "Users can add pois to lists they have access to"
  ON pois FOR INSERT
  WITH CHECK (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update pois in lists they have access to" ON pois;
CREATE POLICY "Users can update pois in lists they have access to"
  ON pois FOR UPDATE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

DROP POLICY IF EXISTS "Editors can delete pois from lists" ON pois;
CREATE POLICY "Editors can delete pois from lists"
  ON pois FOR DELETE
  USING (user_has_verified_terms_and_age() AND is_list_owner_or_editor(pois.list_id, auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_pois_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS update_pois_updated_at ON pois;
CREATE TRIGGER update_pois_updated_at BEFORE UPDATE ON pois
  FOR EACH ROW EXECUTE FUNCTION update_pois_updated_at();

-- Broadcast POI changes to realtime channel list:<list_id>
CREATE OR REPLACE FUNCTION public.pois_broadcast_list_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payload jsonb;
  msg jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload := row_to_json(OLD)::jsonb;
    msg := jsonb_build_object('old_record', payload);
    PERFORM realtime.send(msg, 'POI_DELETE', 'list:' || OLD.list_id::text, true);
  ELSE
    payload := row_to_json(NEW)::jsonb;
    msg := jsonb_build_object('record', payload);
    IF TG_OP = 'INSERT' THEN
      PERFORM realtime.send(msg, 'POI_INSERT', 'list:' || NEW.list_id::text, true);
    ELSE
      PERFORM realtime.send(msg, 'POI_UPDATE', 'list:' || NEW.list_id::text, true);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pois_broadcast_list_trigger ON public.pois;
CREATE TRIGGER pois_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.pois
  FOR EACH ROW EXECUTE FUNCTION public.pois_broadcast_list_trigger();
