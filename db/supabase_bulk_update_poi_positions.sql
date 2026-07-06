-- One-shot bulk board position update (run in Supabase SQL editor).
-- Replaces N per-row PATCH calls with a single RPC.

CREATE OR REPLACE FUNCTION public.bulk_update_poi_positions(
  p_list_id uuid,
  p_positions jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;

  IF p_positions IS NULL OR jsonb_typeof(p_positions) <> 'array' THEN
    RAISE EXCEPTION 'p_positions must be a JSON array' USING errcode = '22023';
  END IF;

  UPDATE public.pois AS p
  SET
    board_x = (elem->>'board_x')::double precision,
    board_y = (elem->>'board_y')::double precision,
    subgroup_id = CASE
      WHEN elem ? 'subgroup_id' THEN (elem->>'subgroup_id')::uuid
      ELSE p.subgroup_id
    END
  FROM jsonb_array_elements(p_positions) AS elem
  WHERE p.id = (elem->>'id')::uuid
    AND p.list_id = p_list_id
    AND (elem->>'board_x') IS NOT NULL
    AND (elem->>'board_y') IS NOT NULL
    AND (elem->>'board_x')::double precision BETWEEN 0 AND 1
    AND (elem->>'board_y')::double precision BETWEEN 0 AND 1
    AND (
      NOT (elem ? 'subgroup_id')
      OR (elem->>'subgroup_id') IS NULL
      OR EXISTS (
        SELECT 1 FROM public.board_subgroups sg
        WHERE sg.id = (elem->>'subgroup_id')::uuid
          AND sg.list_id = p_list_id
      )
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_update_poi_positions(uuid, jsonb) TO authenticated;
