
ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- Host-only check-in by guest pass token
CREATE OR REPLACE FUNCTION public.check_in_guest_by_token(
  p_event_id uuid,
  p_token text
)
RETURNS TABLE (id uuid, guest_name text, guest_email text, checked_in_at timestamptz, was_already_checked_in boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_host boolean;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creative_jams cj
    WHERE cj.id = p_event_id AND cj.created_by = v_uid
  ) INTO v_is_host;

  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the event host can check in guests' USING ERRCODE = '42501';
  END IF;

  SELECT gr.id, gr.guest_name, gr.guest_email, gr.checked_in_at
  INTO v_row
  FROM public.guest_rsvps gr
  WHERE gr.event_id = p_event_id AND gr.check_in_token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No matching guest pass for this event' USING ERRCODE = '02000';
  END IF;

  IF v_row.checked_in_at IS NOT NULL THEN
    id := v_row.id; guest_name := v_row.guest_name; guest_email := v_row.guest_email;
    checked_in_at := v_row.checked_in_at; was_already_checked_in := true;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.guest_rsvps
     SET checked_in_at = now(), updated_at = now()
   WHERE guest_rsvps.id = v_row.id
   RETURNING guest_rsvps.id, guest_rsvps.guest_name, guest_rsvps.guest_email, guest_rsvps.checked_in_at
   INTO v_row;

  id := v_row.id; guest_name := v_row.guest_name; guest_email := v_row.guest_email;
  checked_in_at := v_row.checked_in_at; was_already_checked_in := false;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_guest_by_token(uuid, text) TO authenticated;
