-- 1. Allow guest participants (no user_id)
ALTER TABLE public.jam_participants ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add guest identity columns
ALTER TABLE public.jam_participants
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;

-- 3. Replace the (jam_id, user_id) unique constraint with partial unique indexes
ALTER TABLE public.jam_participants
  DROP CONSTRAINT IF EXISTS jam_participants_jam_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS jam_participants_jam_user_uniq
  ON public.jam_participants (jam_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jam_participants_jam_guest_email_uniq
  ON public.jam_participants (jam_id, lower(guest_email))
  WHERE user_id IS NULL AND guest_email IS NOT NULL;

-- 4. Backfill existing guest_rsvps into jam_participants
INSERT INTO public.jam_participants (jam_id, user_id, guest_name, guest_email, status, joined_at, is_visible)
SELECT
  gr.event_id,
  NULL,
  gr.guest_name,
  lower(gr.guest_email),
  COALESCE(gr.status, 'going'),
  gr.created_at,
  true
FROM public.guest_rsvps gr
WHERE gr.claimed_by_user_id IS NULL
ON CONFLICT DO NOTHING;

-- For already-claimed guest_rsvps, ensure a user-linked participant exists
INSERT INTO public.jam_participants (jam_id, user_id, status, joined_at, is_visible)
SELECT
  gr.event_id,
  gr.claimed_by_user_id,
  COALESCE(gr.status, 'going'),
  gr.claimed_at,
  true
FROM public.guest_rsvps gr
WHERE gr.claimed_by_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 5. Update guest_rsvp_upsert to dual-write into jam_participants
CREATE OR REPLACE FUNCTION public.guest_rsvp_upsert(p_event_id uuid, p_guest_name text, p_guest_email text)
 RETURNS TABLE(check_in_token uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Dual-write: also mirror into jam_participants so host roster, co-host
  -- promotion, check-in and matching surfaces include guests.
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
$function$;