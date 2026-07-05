-- Board subgroups: nested frames for organizing POIs on the cork board.
-- Idempotent: safe to re-run on existing databases.

CREATE TABLE IF NOT EXISTS board_subgroups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  parent_subgroup_id UUID REFERENCES board_subgroups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  board_x DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  board_y DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  board_w DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  board_h DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  board_z INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT board_subgroups_board_x_range CHECK (board_x >= 0 AND board_x <= 1),
  CONSTRAINT board_subgroups_board_y_range CHECK (board_y >= 0 AND board_y <= 1),
  CONSTRAINT board_subgroups_board_w_range CHECK (board_w > 0 AND board_w <= 1),
  CONSTRAINT board_subgroups_board_h_range CHECK (board_h > 0 AND board_h <= 1),
  CONSTRAINT board_subgroups_fits_parent CHECK (
    board_x + board_w <= 1.000001 AND board_y + board_h <= 1.000001
  )
);

CREATE INDEX IF NOT EXISTS idx_board_subgroups_list_id ON board_subgroups(list_id);
CREATE INDEX IF NOT EXISTS idx_board_subgroups_parent ON board_subgroups(list_id, parent_subgroup_id);

ALTER TABLE board_subgroups ENABLE ROW LEVEL SECURITY;

ALTER TABLE pois
  ADD COLUMN IF NOT EXISTS subgroup_id UUID REFERENCES board_subgroups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pois_subgroup_id ON pois(list_id, subgroup_id);
