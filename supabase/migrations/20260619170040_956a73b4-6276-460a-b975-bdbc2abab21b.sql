-- Ensure pgcrypto is available (belt and braces) and remove the runtime dependency
-- on unqualified gen_random_bytes() from the spark_rooms invite_code default.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Swap spark_rooms.invite_code default to a uuid-derived 12-char code that never
-- requires pgcrypto to be on the search_path. This is what was breaking
-- "Create project" / "Open room" with: function gen_random_bytes(integer) does not exist
ALTER TABLE public.spark_rooms
  ALTER COLUMN invite_code SET DEFAULT lower(replace(gen_random_uuid()::text, '-', ''))::text;

-- Backfill any nulls just in case
UPDATE public.spark_rooms
SET invite_code = lower(replace(gen_random_uuid()::text, '-', ''))
WHERE invite_code IS NULL;