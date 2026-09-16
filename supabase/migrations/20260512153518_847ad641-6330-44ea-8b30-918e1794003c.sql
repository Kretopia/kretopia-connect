
CREATE OR REPLACE FUNCTION public.guest_rsvp_upsert(
  p_event_id uuid,
  p_guest_name text,
  p_guest_email text
)
RETURNS TABLE (check_in_token uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_event record;
  v_token uuid;
  v_status text;
BEGIN
  -- Normalize + validate inputs
  v_name := btrim(coalesce(p_guest_name, ''));
  v_email := lower(btrim(coalesce(p_guest_email, '')));

  IF length(v_name) < 1 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) < 3 OR length(v_email) > 255
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  -- Validate event exists and accepts guest RSVPs
  SELECT id, status, visibility
  INTO v_event
  FROM public.creative_jams
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000';
  END IF;
  IF v_event.status = 'cancelled' THEN
    RAISE EXCEPTION 'Event cancelled' USING ERRCODE = '22023';
  END IF;
  IF v_event.visibility IS NOT NULL AND v_event.visibility <> 'public' THEN
    RAISE EXCEPTION 'Event not open to guests' USING ERRCODE = '42501';
  END IF;

  -- Upsert as the function owner (bypasses RLS by design, narrow scope)
  INSERT INTO public.guest_rsvps (event_id, guest_name, guest_email, status)
  VALUES (p_event_id, v_name, v_email, 'going')
  ON CONFLICT (event_id, guest_email)
  DO UPDATE SET
    guest_name = EXCLUDED.guest_name,
    status = 'going',
    updated_at = now()
  RETURNING guest_rsvps.check_in_token, guest_rsvps.status
  INTO v_token, v_status;

  RETURN QUERY SELECT v_token, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_rsvp_upsert(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.guest_rsvp_upsert(uuid, text, text) TO anon, authenticated;
