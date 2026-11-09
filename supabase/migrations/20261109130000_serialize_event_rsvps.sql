CREATE OR REPLACE FUNCTION public.rsvp_to_event(
  p_event_id UUID,
  p_referred_by UUID DEFAULT NULL,
  p_referral_channel TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_title TEXT;
  v_max INTEGER;
  v_count INTEGER;
  v_waitlist_enabled BOOLEAN;
  v_existing TEXT;
  v_position INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT title, max_participants, waitlist_enabled
    INTO v_title, v_max, v_waitlist_enabled
  FROM public.creative_jams
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  SELECT status INTO v_existing
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND user_id = v_user;

  IF v_existing IS NOT NULL AND v_existing <> 'cancelled' THEN
    RETURN 'already';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND status <> 'cancelled';

  IF v_max IS NOT NULL AND v_max > 0 AND v_count >= v_max THEN
    IF v_waitlist_enabled THEN
      SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
      FROM public.event_waitlist
      WHERE event_id = p_event_id;

      INSERT INTO public.event_waitlist (event_id, user_id, position, status)
      VALUES (p_event_id, v_user, v_position, 'waiting')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.notifications (user_id, type, title, message, action_url)
      VALUES (
        v_user,
        'event_waitlisted',
        'You''re on the waitlist',
        'We''ll notify you the moment a spot opens for ' || v_title || '.',
        '/event/' || p_event_id
      );

      RETURN 'waitlisted';
    END IF;
    RETURN 'full_no_waitlist';
  END IF;

  INSERT INTO public.jam_participants (jam_id, user_id, status, referred_by, referral_channel)
  VALUES (p_event_id, v_user, 'going', p_referred_by, p_referral_channel)
  ON CONFLICT (jam_id, user_id) WHERE user_id IS NOT NULL
    DO UPDATE SET status = 'going',
                  referred_by = COALESCE(EXCLUDED.referred_by, jam_participants.referred_by),
                  referral_channel = COALESCE(EXCLUDED.referral_channel, jam_participants.referral_channel);

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    v_user,
    'event_rsvp',
    'You''re registered!',
    'You''re going to ' || v_title || '.',
    '/event/' || p_event_id
  );

  IF p_referred_by IS NOT NULL THEN
    UPDATE public.event_share_clicks
       SET converted_to_rsvp = true
     WHERE event_id = p_event_id
       AND referrer_user_id = p_referred_by
       AND converted_to_rsvp = false;
  END IF;

  RETURN 'joined';
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_event_guest_rsvp(
  p_event_id UUID,
  p_guest_name TEXT,
  p_guest_email TEXT
)
RETURNS TABLE(check_in_token UUID, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT := btrim(coalesce(p_guest_name, ''));
  v_email TEXT := lower(btrim(coalesce(p_guest_email, '')));
  v_max INTEGER;
  v_event_status TEXT;
  v_is_public BOOLEAN;
  v_count BIGINT;
  v_token UUID;
  v_status TEXT;
BEGIN
  IF length(v_name) < 1 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'Invalid name' USING ERRCODE = '22023';
  END IF;
  IF length(v_email) < 3 OR length(v_email) > 255
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  SELECT cj.max_participants, cj.status, cj.is_public
    INTO v_max, v_event_status, v_is_public
  FROM public.creative_jams cj
  WHERE cj.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000';
  END IF;
  IF v_event_status = 'cancelled' THEN
    RAISE EXCEPTION 'Event cancelled' USING ERRCODE = '22023';
  END IF;
  IF coalesce(v_is_public, false) = false THEN
    RAISE EXCEPTION 'Event not open to guests' USING ERRCODE = '42501';
  END IF;

  SELECT gr.check_in_token, gr.status
    INTO v_token, v_status
  FROM public.guest_rsvps gr
  WHERE gr.event_id = p_event_id
    AND lower(gr.guest_email) = v_email;

  IF FOUND AND coalesce(v_status, 'going') <> 'cancelled' THEN
    check_in_token := v_token;
    status := coalesce(v_status, 'going');
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jam_participants jp
  WHERE jp.jam_id = p_event_id
    AND jp.status <> 'cancelled';

  IF v_max IS NOT NULL AND v_max > 0 AND v_count >= v_max THEN
    check_in_token := NULL;
    status := 'full_no_waitlist';
    RETURN NEXT;
    RETURN;
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

  INSERT INTO public.jam_participants (jam_id, user_id, guest_name, guest_email, status, is_visible)
  VALUES (p_event_id, NULL, v_name, v_email, 'going', true)
  ON CONFLICT (jam_id, lower(guest_email)) WHERE user_id IS NULL AND guest_email IS NOT NULL
  DO UPDATE SET
    guest_name = EXCLUDED.guest_name,
    status = 'going';

  check_in_token := v_token;
  status := v_status;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_event_guest_rsvp(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_event_guest_rsvp(UUID, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_event_rsvp(p_event_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  PERFORM 1
  FROM public.creative_jams
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  UPDATE public.jam_participants
  SET status = 'cancelled'
  WHERE jam_id = p_event_id
    AND user_id = v_user
    AND status <> 'cancelled';

  IF NOT FOUND THEN
    RETURN 'not_going';
  END IF;

  RETURN 'cancelled';
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_event_rsvp(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_event_rsvp(UUID) TO authenticated;
