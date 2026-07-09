-- Register poi_images rows when files land in getaway-images storage.
-- Run in Supabase SQL Editor on existing projects.

CREATE UNIQUE INDEX IF NOT EXISTS idx_poi_images_poi_id_image_url ON poi_images(poi_id, image_url);

CREATE OR REPLACE FUNCTION public.getaway_storage_image_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  poi_uuid uuid;
  image_path text;
  file_part text;
  pos int;
  existing_count int;
BEGIN
  IF NEW.bucket_id IS DISTINCT FROM 'getaway-images' THEN
    RETURN NEW;
  END IF;

  image_path := NEW.name;

  BEGIN
    poi_uuid := (split_part(image_path, '/', 1))::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NEW;
  END;

  IF NOT EXISTS (SELECT 1 FROM pois p WHERE p.id = poi_uuid) THEN
    RETURN NEW;
  END IF;

  file_part := split_part(image_path, '/', 2);
  IF file_part IS NULL OR file_part = '' THEN
    RETURN NEW;
  END IF;

  BEGIN
    pos := (substring(file_part from '^([0-9]+)'))::int;
  EXCEPTION WHEN OTHERS THEN
    pos := NULL;
  END;
  IF pos IS NULL THEN
    SELECT COALESCE(MAX(pi.position), -1) + 1 INTO pos
    FROM poi_images pi WHERE pi.poi_id = poi_uuid;
  END IF;

  SELECT COUNT(*) INTO existing_count FROM poi_images WHERE poi_id = poi_uuid;
  IF existing_count >= 10 THEN
    RETURN NEW;
  END IF;

  INSERT INTO poi_images (poi_id, image_url, position)
  VALUES (poi_uuid, image_path, pos)
  ON CONFLICT (poi_id, image_url) DO NOTHING;

  UPDATE pois
  SET thumbnail_url = image_path
  WHERE id = poi_uuid
    AND (thumbnail_url IS NULL OR btrim(thumbnail_url) = '');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS getaway_storage_image_trigger ON storage.objects;
CREATE TRIGGER getaway_storage_image_trigger
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'getaway-images')
  EXECUTE FUNCTION public.getaway_storage_image_trigger();
