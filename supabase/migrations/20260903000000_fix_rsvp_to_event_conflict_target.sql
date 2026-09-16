-- Fix rsvp_to_event: its INSERT ... ON CONFLICT (jam_id, user_id) has been
-- broken since 20260517234348_be1c9a26-...sql replaced the plain
-- UNIQUE(jam_id, user_id) constraint with a partial index
-- (jam_participants_jam_user_uniq ON (jam_id, user_id) WHERE user_id IS NOT NULL)
-- to make room for guest rows. A bare ON CONFLICT (jam_id, user_id) no longer
-- matches any constraint/index, so every call raised
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
-- guest_rsvp_upsert's dual-write was correctly updated to add the WHERE
-- predicate at the time; this function was missed. Same fix here: match the
-- partial index's predicate exactly.
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
  v_max INTEGER;
  v_count INTEGER;
  v_waitlist_enabled BOOLEAN;
  v_existing TEXT;
  v_position INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT max_participants, waitlist_enabled
    INTO v_max, v_waitlist_enabled
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
