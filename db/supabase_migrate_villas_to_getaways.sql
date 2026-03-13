-- ============================================================================
-- MIGRATION: villas / villa_images → getaways / getaway_images
-- Run this in the Supabase SQL Editor against your project.
-- Backup your database first (Dashboard → Database → Backups).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Create new tables
-- ----------------------------------------------------------------------------

CREATE TABLE getaways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  user_id UUID,
  slug TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_url TEXT,
  import_status TEXT NOT NULL DEFAULT 'loading'
    CHECK (import_status IN ('loading', 'loaded', 'thin', 'error')),
  import_error TEXT,
  name TEXT,
  location TEXT,
  region TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  max_guests INTEGER,
  price DECIMAL(12, 2),
  price_currency TEXT,
  price_period TEXT,
  price_note TEXT,
  deposit DECIMAL(12, 2),
  amenities TEXT[],
  included TEXT[],
  description TEXT,
  caveats TEXT,
  UNIQUE(list_id, slug)
);

CREATE INDEX idx_getaways_list_id ON getaways(list_id);
CREATE INDEX idx_getaways_user_id ON getaways(user_id);
CREATE INDEX idx_getaways_created_at ON getaways(created_at DESC);
CREATE INDEX idx_getaways_import_status ON getaways(import_status);

ALTER TABLE getaways ENABLE ROW LEVEL SECURITY;


CREATE TABLE getaway_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  getaway_id UUID NOT NULL REFERENCES getaways(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_getaway_images_getaway_id ON getaway_images(getaway_id);

ALTER TABLE getaway_images ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 2. Migrate data: villas → getaways (same id for FK continuity)
-- ----------------------------------------------------------------------------

INSERT INTO getaways (
  id,
  list_id,
  user_id,
  slug,
  created_at,
  updated_at,
  source_url,
  import_status,
  import_error,
  name,
  location,
  region,
  bedrooms,
  bathrooms,
  max_guests,
  price,
  price_currency,
  price_period,
  deposit,
  amenities,
  included,
  description,
  caveats
)
SELECT
  v.id,
  v.list_id,
  v.user_id,
  v.slug,
  v.created_at,
  v.updated_at,
  v.original_url,
  v.scrap_status,
  v.scrap_error,
  NULLIF(TRIM(COALESCE(v.villa_name, v.title, '')), ''),
  v.location,
  v.region,
  v.bedrooms,
  v.bathrooms,
  v.max_guests,
  COALESCE(v.price_weekly_usd, v.price_weekly_min_eur),
  CASE
    WHEN v.price_weekly_usd IS NOT NULL THEN 'USD'
    WHEN v.price_weekly_min_eur IS NOT NULL OR v.price_weekly_max_eur IS NOT NULL THEN 'EUR'
    ELSE NULL
  END,
  'week',
  v.security_deposit_eur,
  (
    SELECT array_agg(x) FROM unnest(
      COALESCE(v.pool_features, '{}') ||
      COALESCE(v.amenities, '{}') ||
      COALESCE(v.extras, '{}')
    ) AS x
    WHERE x IS NOT NULL AND TRIM(x) <> ''
  ),
  v.included_in_price,
  NULLIF(TRIM(CONCAT_WS(E'\n\n',
    v.interiors_summary,
    v.exteriors_summary,
    v.location_summary
  )), ''),
  v.the_catch
FROM villas v;


-- ----------------------------------------------------------------------------
-- 3. Migrate villa_images → getaway_images (villa_id = getaway id)
-- ----------------------------------------------------------------------------

INSERT INTO getaway_images (id, getaway_id, image_url, position, created_at)
SELECT id, villa_id, image_url, position, created_at
FROM villa_images;


-- ----------------------------------------------------------------------------
-- 4. Migrate villas.images array into getaway_images (legacy row-level URLs)
-- ----------------------------------------------------------------------------

INSERT INTO getaway_images (getaway_id, image_url, position, created_at)
SELECT
  v.id,
  elem,
  ord,
  NOW()
FROM villas v,
     unnest(COALESCE(v.images, '{}')) WITH ORDINALITY AS t(elem, ord)
WHERE v.images IS NOT NULL AND array_length(v.images, 1) > 0;


-- ----------------------------------------------------------------------------
-- 5. Drop old RLS policies and triggers
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view villas in their lists" ON villas;
DROP POLICY IF EXISTS "Users can add villas to lists they have access to" ON villas;
DROP POLICY IF EXISTS "Users can update villas in lists they have access to" ON villas;
DROP POLICY IF EXISTS "Admins can delete villas from lists" ON villas;

DROP POLICY IF EXISTS "Users can view images in their villas" ON villa_images;
DROP POLICY IF EXISTS "Users can add images to their villas" ON villa_images;

DROP TRIGGER IF EXISTS villas_broadcast_list_trigger ON public.villas;
DROP TRIGGER IF EXISTS update_villas_updated_at ON villas;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'villas'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE villas;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 5b. Drop storage policies that depend on villas (so we can drop the table)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow villa image uploads" ON storage.objects;
DROP POLICY IF EXISTS "List members can view villa images" ON storage.objects;


-- ----------------------------------------------------------------------------
-- 6. Drop old tables
-- ----------------------------------------------------------------------------

DROP TABLE villa_images;
DROP TABLE villas;


-- ----------------------------------------------------------------------------
-- 7. RLS policies for getaways
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view getaways in their lists"
  ON getaways FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = getaways.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
             ))
    )
  );

CREATE POLICY "Users can add getaways to lists they have access to"
  ON getaways FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = getaways.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role IN ('admin', 'editor')
             ))
    )
  );

CREATE POLICY "Users can update getaways in lists they have access to"
  ON getaways FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = getaways.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role IN ('admin', 'editor')
             ))
    )
  );

CREATE POLICY "Admins can delete getaways from lists"
  ON getaways FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lists
      WHERE lists.id = getaways.list_id
        AND (lists.user_id = auth.uid() OR
             EXISTS (
               SELECT 1 FROM list_members
               WHERE list_members.list_id = lists.id
                 AND list_members.user_id = auth.uid()
                 AND list_members.role = 'admin'
             ))
    )
  );


-- ----------------------------------------------------------------------------
-- 8. RLS policies for getaway_images
-- ----------------------------------------------------------------------------

CREATE POLICY "Users can view images in their getaways"
  ON getaway_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM getaways
      WHERE getaways.id = getaway_images.getaway_id
        AND EXISTS (
          SELECT 1 FROM lists
          WHERE lists.id = getaways.list_id
            AND (lists.user_id = auth.uid() OR
                 EXISTS (
                   SELECT 1 FROM list_members
                   WHERE list_members.list_id = lists.id
                     AND list_members.user_id = auth.uid()
                 ))
        )
    )
  );

CREATE POLICY "Users can add images to their getaways"
  ON getaway_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM getaways
      WHERE getaways.id = getaway_images.getaway_id
        AND EXISTS (
          SELECT 1 FROM lists
          WHERE lists.id = getaways.list_id
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


-- ----------------------------------------------------------------------------
-- 9. Trigger: updated_at for getaways
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_getaways_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_getaways_updated_at
  BEFORE UPDATE ON getaways
  FOR EACH ROW EXECUTE FUNCTION update_getaways_updated_at();


-- ----------------------------------------------------------------------------
-- 10. Realtime: add getaways
-- ----------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE getaways;


-- ----------------------------------------------------------------------------
-- 10b. Storage: new bucket getaway-images (path = getaway_id/filename)
--     Old bucket villa-images: keep SELECT-only so existing objects stay viewable.
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('getaway-images', 'getaway-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- SECURITY DEFINER so storage INSERT policy can read getaways/lists without RLS blocking
CREATE OR REPLACE FUNCTION public.can_upload_getaway_image(object_path text, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM getaways g
    JOIN lists l ON l.id = g.list_id
    WHERE g.id::text = split_part(object_path, '/', 1)
      AND (l.user_id = check_user_id
           OR EXISTS (
             SELECT 1 FROM list_members lm
             WHERE lm.list_id = g.list_id AND lm.user_id = check_user_id AND lm.role IN ('admin', 'editor')
           ))
  );
$$;

CREATE POLICY "Allow getaway image uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'getaway-images'
  AND public.can_upload_getaway_image(name, auth.uid())
);

CREATE POLICY "List members can view getaway images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'getaway-images'
  AND EXISTS (
    SELECT 1 FROM getaways g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (
      EXISTS (SELECT 1 FROM lists l WHERE l.id = g.list_id AND l.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = g.list_id AND lm.user_id = auth.uid())
    )
  )
);

-- Legacy bucket: allow SELECT only so existing objects (villa_id = getaway_id) still work
CREATE POLICY "List members can view legacy villa-images" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'villa-images'
  AND EXISTS (
    SELECT 1 FROM getaways g
    WHERE g.id::text = (storage.foldername(name))[1]
    AND (
      EXISTS (SELECT 1 FROM lists l WHERE l.id = g.list_id AND l.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM list_members lm WHERE lm.list_id = g.list_id AND lm.user_id = auth.uid())
    )
  )
);


-- ----------------------------------------------------------------------------
-- 11. Broadcast trigger for getaways (if you use supabase_broadcast_villas)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.getaways_broadcast_list_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'list:' || COALESCE(NEW.list_id, OLD.list_id)::text,
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER getaways_broadcast_list_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.getaways
  FOR EACH ROW EXECUTE FUNCTION public.getaways_broadcast_list_trigger();

COMMIT;


-- ============================================================================
-- AFTER MIGRATION
-- ============================================================================
-- 1. Storage: Update bucket policies to reference getaways instead of villas.
--    Either run a storage policy migration (villa-images bucket: replace
--    "villas v" with "getaways g" and "v.id" with "g.id", path still {id}/file).
-- 2. Backend/Frontend: Point code to "getaways" and "getaway_images", and
--    use new column names (name, source_url, import_status, price, etc.).
-- ============================================================================
