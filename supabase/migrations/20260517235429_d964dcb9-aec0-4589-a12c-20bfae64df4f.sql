
-- Claim function: link guest_rsvps by email to a user, and upgrade jam_participants rows
CREATE OR REPLACE FUNCTION public.claim_guest_rsvps(_email text, _user_id uuid)
RETURNS TABLE(claimed_count int, participant_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_claimed int := 0;
  v_parts int := 0;
  r record;
BEGIN
  IF v_email IS NULL OR v_email = '' OR _user_id IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Mark guest_rsvps as claimed
  UPDATE public.guest_rsvps
     SET claimed_by_user_id = _user_id,
         claimed_at = COALESCE(claimed_at, now()),
         updated_at = now()
   WHERE lower(guest_email) = v_email
     AND claimed_by_user_id IS DISTINCT FROM _user_id;
  GET DIAGNOSTICS v_claimed = ROW_COUNT;

  -- For each event the guest RSVP'd to, ensure a jam_participants row exists for the new user
  FOR r IN
    SELECT DISTINCT event_id
      FROM public.guest_rsvps
     WHERE lower(guest_email) = v_email
  LOOP
    -- If guest row exists in jam_participants (user_id null), claim it; else insert
    UPDATE public.jam_participants
       SET user_id = _user_id,
           guest_name = NULL,
           guest_email = NULL
     WHERE jam_id = r.event_id
       AND user_id IS NULL
       AND lower(guest_email) = v_email
       AND NOT EXISTS (
         SELECT 1 FROM public.jam_participants jp2
          WHERE jp2.jam_id = r.event_id AND jp2.user_id = _user_id
       );

    INSERT INTO public.jam_participants (jam_id, user_id, status, is_visible)
    VALUES (r.event_id, _user_id, 'going', true)
    ON CONFLICT (jam_id, user_id) WHERE user_id IS NOT NULL DO NOTHING;

    -- Clean up any leftover guest participant row for this email/event
    DELETE FROM public.jam_participants
     WHERE jam_id = r.event_id
       AND user_id IS NULL
       AND lower(guest_email) = v_email;

    v_parts := v_parts + 1;
  END LOOP;

  RETURN QUERY SELECT v_claimed, v_parts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_guest_rsvps(text, uuid) TO authenticated, service_role;

-- Trigger on new auth.users — auto-claim by email
CREATE OR REPLACE FUNCTION public.handle_new_user_claim_rsvps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    PERFORM public.claim_guest_rsvps(NEW.email, NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- never block signup
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_claim_rsvps ON auth.users;
CREATE TRIGGER on_auth_user_created_claim_rsvps
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_claim_rsvps();
