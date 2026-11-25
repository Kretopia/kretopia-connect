-- LOT T1 -- 02 APPLY. SQL Editor of "kretopia-app" only, after 01_preflight.sql. One transaction.
-- Adds two read-only helpers, replaces the body of rsvp_to_event (the version of 20260903020000 plus one check) and replaces two
-- policies on jam_participants. Changes nothing for free events, for external-ticket events, for hosts, co-hosts or paid buyers.
BEGIN;

DO $assert$
BEGIN
  IF to_regprocedure('public.rsvp_to_event(uuid, uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: rsvp_to_event(uuid, uuid, text) is missing. Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.rsvp_to_event(uuid, uuid, text)')
                 AND prosrc LIKE '%event_rsvp%' AND prosrc NOT LIKE '%may_take_event_seat%') THEN
    RAISE EXCEPTION 'APPLY STOPPED: rsvp_to_event is not the version this lot replaces (already applied, or changed by hand). Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jam_participants' AND policyname = 'Users can join jams')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jam_participants' AND policyname = 'Users can update their own participation') THEN
    RAISE EXCEPTION 'APPLY STOPPED: a jam_participants policy this lot replaces is missing. Nothing was changed.';
  END IF;
  IF to_regclass('public.event_co_hosts') IS NULL OR to_regclass('public.event_ticket_tiers') IS NULL OR to_regclass('public.event_orders') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: event_co_hosts, event_ticket_tiers or event_orders is missing. Nothing was changed.';
  END IF;
END
$assert$;

-- Does this event sell paid tickets on Kretopia? (The rule sync_general_admission_tier() uses, plus a paid tier added by the host.)
CREATE OR REPLACE FUNCTION public.event_sells_paid_tickets(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creative_jams j
    WHERE j.id = _event_id
      AND coalesce(j.is_ticketed, false)
      AND coalesce(j.external_ticket_url, '') = ''
      AND (
        coalesce(j.ticket_price, 0) > 0
        OR EXISTS (SELECT 1 FROM public.event_ticket_tiers t WHERE t.event_id = j.id AND coalesce(t.price, 0) > 0)
      )
  );
$$;

-- May this person take a seat? Any event that sells no paid ticket, its host, its co-hosts, and a buyer with a paid order.
CREATE OR REPLACE FUNCTION public.may_take_event_seat(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.event_sells_paid_tickets(_event_id)
      OR EXISTS (SELECT 1 FROM public.creative_jams j WHERE j.id = _event_id AND j.created_by = _user_id)
      OR EXISTS (SELECT 1 FROM public.event_co_hosts ch WHERE ch.event_id = _event_id AND ch.user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.event_orders o WHERE o.event_id = _event_id AND o.buyer_id = _user_id AND o.status = 'paid');
$$;

REVOKE ALL ON FUNCTION public.event_sells_paid_tickets(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.may_take_event_seat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_sells_paid_tickets(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.may_take_event_seat(uuid, uuid) TO authenticated, service_role;

-- rsvp_to_event: the body of 20260903020000_notify_on_event_rsvp.sql with ONE added check, marked below. It answers
-- 'ticket_required' instead of seating someone who has not bought a ticket.
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

  -- LOT T1 (the only added lines): an event that sells paid tickets is entered with one.
  IF NOT public.may_take_event_seat(p_event_id, v_user) THEN
    RETURN 'ticket_required';
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

-- The direct door: a member inserts their own row. Same rule. (Service-role functions and SECURITY DEFINER functions, such as the
-- ticket fulfilment and the waitlist promotion, bypass row-level security and are not affected.)
DROP POLICY IF EXISTS "Users can join jams" ON public.jam_participants;
CREATE POLICY "Users can join jams"
ON public.jam_participants FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.may_take_event_seat(jam_id, auth.uid()));

-- A member can still cancel or decline their own answer on any event; moving to a seat-holding answer needs the same right.
DROP POLICY IF EXISTS "Users can update their own participation" ON public.jam_participants;
CREATE POLICY "Users can update their own participation"
ON public.jam_participants FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND (status IN ('cancelled', 'declined') OR public.may_take_event_seat(jam_id, auth.uid())));

COMMIT;
