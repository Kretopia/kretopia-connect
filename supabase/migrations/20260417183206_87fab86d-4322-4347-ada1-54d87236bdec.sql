CREATE OR REPLACE FUNCTION public.admin_set_profile_coords(coords jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb;
  updated int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    -- allow service-role / no-auth call too (used for one-off backfill)
    IF auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  FOR rec IN SELECT * FROM jsonb_array_elements(coords)
  LOOP
    UPDATE public.profiles
    SET latitude = (rec->>'lat')::double precision,
        longitude = (rec->>'lng')::double precision
    WHERE user_id = (rec->>'user_id')::uuid
      AND (latitude IS NULL OR longitude IS NULL);
    GET DIAGNOSTICS updated = ROW_COUNT;
  END LOOP;

  RETURN updated;
END;
$$;