CREATE TABLE public.public_presence_search_quota (
  bucket text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.public_presence_search_quota TO service_role;
REVOKE ALL ON public.public_presence_search_quota FROM anon, authenticated;
ALTER TABLE public.public_presence_search_quota ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can touch counters.

-- Server-owned global limits: 30 searches per minute, 1500 per UTC day.
CREATE OR REPLACE FUNCTION public.consume_public_presence_search()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  minute_key text := 'm:' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI');
  day_key text := 'd:' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  minute_used integer;
  day_used integer;
BEGIN
  INSERT INTO public.public_presence_search_quota AS q (bucket, used) VALUES (day_key, 1)
  ON CONFLICT (bucket) DO UPDATE SET used = q.used + 1, updated_at = now()
  WHERE q.used < 1500
  RETURNING used INTO day_used;
  IF day_used IS NULL THEN RETURN false; END IF;

  INSERT INTO public.public_presence_search_quota AS q (bucket, used) VALUES (minute_key, 1)
  ON CONFLICT (bucket) DO UPDATE SET used = q.used + 1, updated_at = now()
  WHERE q.used < 30
  RETURNING used INTO minute_used;
  IF minute_used IS NULL THEN
    UPDATE public.public_presence_search_quota SET used = used - 1 WHERE bucket = day_key;
    RETURN false;
  END IF;

  DELETE FROM public.public_presence_search_quota
  WHERE bucket LIKE 'm:%' AND updated_at < now() - interval '1 hour';
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_public_presence_search() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_presence_search() TO service_role;