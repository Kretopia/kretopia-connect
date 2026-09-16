-- Joining an event never created any in-app notification for the person who
-- just joined -- confirmed no code anywhere inserts into public.notifications
-- for creative_jams/jam_participants. Add it inside rsvp_to_event itself so
-- it's atomic with the actual join (only fires once a row is really written),
-- following the same user_id/type/title/message/action_url shape already
-- used elsewhere (e.g. apply-to-stage's "New application to your Scout Stage").
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
  FROM public.creative_jams WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  -- Already in?
  SELECT status INTO v_existing
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND user_id = v_user;

  IF v_existing IS NOT NULL AND v_existing <> 'cancelled' THEN
    RETURN 'already';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.jam_participants
  WHERE jam_id = p_event_id AND status <> 'cancelled';

  IF v_max IS NOT NULL AND v_count >= v_max THEN
    IF v_waitlist_enabled THEN
      SELECT COALESCE(MAX(position), 0) + 1 INTO v_position
      FROM public.event_waitlist WHERE event_id = p_event_id;

      INSERT INTO public.event_waitlist (event_id, user_id, position, status)
      VALUES (p_event_id, v_user, v_position, 'waiting')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.notifications (user_id, type, title, message, action_url)
      VALUES (
        v_user, 'event_waitlisted', 'You''re on the waitlist',
        'We''ll notify you the moment a spot opens for ' || v_title || '.',
        '/event/' || p_event_id
      );

      RETURN 'waitlisted';
    ELSE
      RETURN 'full_no_waitlist';
    END IF;
  END IF;

  INSERT INTO public.jam_participants (jam_id, user_id, status, referred_by, referral_channel)
  VALUES (p_event_id, v_user, 'going', p_referred_by, p_referral_channel)
  ON CONFLICT (jam_id, user_id) WHERE user_id IS NOT NULL
    DO UPDATE SET status = 'going',
                  referred_by = COALESCE(EXCLUDED.referred_by, jam_participants.referred_by),
                  referral_channel = COALESCE(EXCLUDED.referral_channel, jam_participants.referral_channel);

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    v_user, 'event_rsvp', 'You''re registered!',
    'You''re going to ' || v_title || '.',
    '/event/' || p_event_id
  );

  -- Mark share-click attribution as converted
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
