-- Enable Supabase Realtime for the villas table
-- Run this in Supabase SQL Editor if Realtime updates aren't appearing
-- Dashboard alternative: Database → Replication → supabase_realtime → add "villas"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'villas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE villas;
  END IF;
END $$;
