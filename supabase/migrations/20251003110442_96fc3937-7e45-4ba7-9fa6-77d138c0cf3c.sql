-- Make invite code validation case-insensitive
CREATE OR REPLACE FUNCTION public.validate_invite_code(code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Find invite code that still has uses left (case-insensitive)
  SELECT * INTO invite_record
  FROM public.invites
  WHERE LOWER(invite_code) = LOWER(code)
  AND current_uses < max_uses
  LIMIT 1;

  RETURN FOUND;
END;
$$;

-- Update use_invite_code to be case-insensitive too
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
  inviter_badge public.user_badge;
  new_user_badge public.user_badge;
BEGIN
  -- Find invite code that still has uses left (case-insensitive)
  SELECT * INTO invite_record
  FROM public.invites
  WHERE LOWER(invite_code) = LOWER(code)
  AND current_uses < max_uses
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Get inviter's badge
  SELECT badge INTO inviter_badge
  FROM public.profiles
  WHERE user_id = invite_record.inviter_id;

  -- Assign badge: OG users pass on OG badge to their direct invites only
  IF inviter_badge = 'og' THEN
    new_user_badge := 'og';
  ELSE
    new_user_badge := 'beta';
  END IF;

  -- Increment usage count
  UPDATE public.invites
  SET 
    current_uses = current_uses + 1,
    invitee_email = CASE 
      WHEN current_uses = 0 THEN user_email
      ELSE invitee_email || ',' || user_email
    END,
    status = CASE 
      WHEN current_uses + 1 >= max_uses THEN 'accepted'
      ELSE 'pending'
    END,
    used_at = CASE 
      WHEN current_uses = 0 THEN now()
      ELSE used_at
    END
  WHERE id = invite_record.id;

  RETURN TRUE;
END;
$$;