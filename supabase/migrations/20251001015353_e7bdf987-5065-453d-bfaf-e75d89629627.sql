-- Add multi-use support to invites table
ALTER TABLE public.invites 
ADD COLUMN max_uses integer DEFAULT 1,
ADD COLUMN current_uses integer DEFAULT 0;

-- Update existing single-use invites
UPDATE public.invites SET max_uses = 1, current_uses = CASE WHEN status = 'accepted' THEN 1 ELSE 0 END;

-- Create improved use_invite_code function that supports multi-use codes
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invite_record RECORD;
  inviter_badge public.user_badge;
  new_user_badge public.user_badge;
BEGIN
  -- Find invite code that still has uses left
  SELECT * INTO invite_record
  FROM public.invites
  WHERE invite_code = code
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
$function$;

-- Function to create a multi-use invite code (owner only)
CREATE OR REPLACE FUNCTION public.create_multi_use_code(owner_email text, num_uses integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  owner_user_id uuid;
  new_code text;
BEGIN
  -- Get owner's user_id
  SELECT id INTO owner_user_id
  FROM auth.users
  WHERE email = owner_email
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Owner email not found';
  END IF;

  -- Verify owner is OG
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = owner_user_id AND badge = 'og'
  ) THEN
    RAISE EXCEPTION 'Only OG users can create multi-use codes';
  END IF;

  -- Generate unique code
  new_code := SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 10);

  -- Insert the multi-use invite
  INSERT INTO public.invites (inviter_id, invitee_email, max_uses, current_uses, invite_code)
  VALUES (owner_user_id, '', num_uses, 0, new_code);

  RETURN new_code;
END;
$function$;