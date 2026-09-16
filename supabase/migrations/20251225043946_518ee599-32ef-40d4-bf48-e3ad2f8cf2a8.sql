-- Add 'odos' to the user_badge enum
ALTER TYPE user_badge ADD VALUE IF NOT EXISTS 'odos';

-- Create the ODOS unlimited invite code
-- First, get or create an admin user to be the inviter
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get the first OG user to be the inviter for ODOS codes
  SELECT user_id INTO admin_user_id
  FROM profiles
  WHERE badge = 'og'
  LIMIT 1;
  
  -- If no OG user, use any admin
  IF admin_user_id IS NULL THEN
    SELECT user_id INTO admin_user_id
    FROM user_roles
    WHERE role = 'admin'
    LIMIT 1;
  END IF;
  
  -- If still null, get any user
  IF admin_user_id IS NULL THEN
    SELECT user_id INTO admin_user_id
    FROM profiles
    LIMIT 1;
  END IF;
  
  -- Insert the ODOS unlimited invite code (999999 uses)
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.invites (inviter_id, invitee_email, invite_code, max_uses, current_uses, status)
    VALUES (admin_user_id, '', 'ODOS2025', 999999, 0, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Update the use_invite_code function to assign ODOS badge for ODOS codes
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text, new_user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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

  -- Check if this is an ODOS community code (case-insensitive)
  IF LOWER(code) LIKE 'odos%' THEN
    new_user_badge := 'odos';
  ELSE
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
  END IF;

  -- Increment usage count and set used_by
  UPDATE public.invites
  SET 
    current_uses = current_uses + 1,
    used_by = CASE 
      WHEN current_uses = 0 THEN new_user_id
      ELSE used_by
    END,
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

  -- Update the new user's badge if we have their user_id
  IF new_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET badge = new_user_badge
    WHERE user_id = new_user_id;
  END IF;

  RETURN TRUE;
END;
$$;