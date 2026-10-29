CREATE TABLE public.username_auth_attempts (
  bucket text PRIMARY KEY,
  used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.username_auth_attempts TO service_role;

ALTER TABLE public.username_auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_username_auth_attempt(_bucket text, _minute_cap integer, _day_cap integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  minute_key text := 'm:' || _bucket || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MI');
  day_key text := 'd:' || _bucket || ':' || to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  minute_used integer;
  day_used integer;
BEGIN
  INSERT INTO public.username_auth_attempts AS q (bucket, used) VALUES (day_key, 1)
  ON CONFLICT (bucket) DO UPDATE SET used = q.used + 1, updated_at = now()
  WHERE q.used < _day_cap
  RETURNING used INTO day_used;
  IF day_used IS NULL THEN RETURN false; END IF;

  INSERT INTO public.username_auth_attempts AS q (bucket, used) VALUES (minute_key, 1)
  ON CONFLICT (bucket) DO UPDATE SET used = q.used + 1, updated_at = now()
  WHERE q.used < _minute_cap
  RETURNING used INTO minute_used;
  IF minute_used IS NULL THEN
    UPDATE public.username_auth_attempts SET used = used - 1 WHERE bucket = day_key;
    RETURN false;
  END IF;

  DELETE FROM public.username_auth_attempts
  WHERE bucket LIKE 'm:%' AND updated_at < now() - interval '1 hour';
  RETURN true;
END;
$function$;