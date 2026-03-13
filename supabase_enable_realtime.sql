-- Enable Supabase Realtime for the getaways table
-- Run this in Supabase SQL Editor if Realtime updates aren't appearing
-- Dashboard alternative: Database → Replication → supabase_realtime → add "getaways"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'getaways'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE getaways;
  END IF;
END $$;
