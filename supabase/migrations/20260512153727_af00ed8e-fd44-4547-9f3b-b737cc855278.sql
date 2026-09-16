
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
  v_name := btrim(coalesce(p_guest_name, ''));
  v_email := lower(btrim(coalesce(p_guest_email, '')));

  IF length(v_name) < 1 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) < 3 OR length(v_email) > 255
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  SELECT cj.id, cj.status AS event_status, cj.is_public
  INTO v_event
  FROM public.creative_jams cj
  WHERE cj.id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000';
  END IF;
  IF v_event.event_status = 'cancelled' THEN
    RAISE EXCEPTION 'Event cancelled' USING ERRCODE = '22023';
  END IF;
  IF coalesce(v_event.is_public, false) = false THEN
    RAISE EXCEPTION 'Event not open to guests' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.guest_rsvps AS gr (event_id, guest_name, guest_email, status)
  VALUES (p_event_id, v_name, v_email, 'going')
  ON CONFLICT (event_id, guest_email)
  DO UPDATE SET
    guest_name = EXCLUDED.guest_name,
    status = 'going',
    updated_at = now()
  RETURNING gr.check_in_token, gr.status
  INTO v_token, v_status;

  check_in_token := v_token;
  status := v_status;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guest_rsvp_upsert(uuid, text, text) TO anon, authenticated;
