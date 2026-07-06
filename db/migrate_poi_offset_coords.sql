-- Convert grouped POI coords from normalized-within-frame to parent-frame offsets.
-- Run once after deploying the offset coordinate model.
-- Root-level POIs (subgroup_id IS NULL) are unchanged.

UPDATE pois p
SET
  board_x = p.board_x * s.board_w,
  board_y = p.board_y * s.board_h
FROM board_subgroups s
WHERE p.subgroup_id = s.id;
