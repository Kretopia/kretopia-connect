
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text, new_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
  new_user_badge public.user_badge;
BEGIN
  SELECT * INTO invite_record
  FROM public.invites
  WHERE LOWER(invite_code) = LOWER(code)
    AND current_uses < max_uses
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- ODOS community codes keep their badge.
  -- All other invites now grant 'beta' (OG is locked at the cap).
  IF LOWER(code) LIKE 'odos%' THEN
    new_user_badge := 'odos';
  ELSE
    new_user_badge := 'beta';
  END IF;

  UPDATE public.invites
  SET 
    current_uses = current_uses + 1,
    used_by = CASE WHEN current_uses = 0 THEN new_user_id ELSE used_by END,
    invitee_email = CASE 
      WHEN current_uses = 0 THEN user_email
      ELSE invitee_email || ',' || user_email
    END,
    status = CASE 
      WHEN current_uses + 1 >= max_uses THEN 'accepted'
      ELSE 'pending'
    END,
    used_at = CASE WHEN current_uses = 0 THEN now() ELSE used_at END
  WHERE id = invite_record.id;

  IF new_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET badge = new_user_badge
    WHERE user_id = new_user_id;
  END IF;

  RETURN TRUE;
END;
$$;
