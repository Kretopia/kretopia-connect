-- Fix the use_invite_code function to properly set used_by
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text, new_user_id uuid DEFAULT NULL)
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

  RETURN TRUE;
END;
$function$;

-- Update handle_new_user to pass user ID to use_invite_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invite_badge public.user_badge;
  provided_invite_code text;
  num_invites integer;
BEGIN
  -- Get the invite code from user metadata
  provided_invite_code := new.raw_user_meta_data->>'invite_code';
  
  -- Consume the invite code and get badge
  IF provided_invite_code IS NOT NULL AND provided_invite_code != '' THEN
    -- Use the invite code with the new user's ID
    PERFORM use_invite_code(provided_invite_code, new.email, new.id);
    
    -- Get the inviter's badge
    SELECT COALESCE(p.badge, 'beta')
    INTO invite_badge
    FROM public.invites i
    JOIN public.profiles p ON p.user_id = i.inviter_id
    WHERE i.invite_code = provided_invite_code
    LIMIT 1;
    
    -- Assign badge based on inviter
    IF invite_badge = 'og' THEN
      invite_badge := 'og';
      num_invites := 100;
    ELSE
      invite_badge := 'beta';
      num_invites := 10;
    END IF;
  ELSE
    -- Default badge if no invite code
    invite_badge := 'beta';
    num_invites := 10;
  END IF;

  -- Create profile with invite code only (full_name and role collected in onboarding)
  INSERT INTO public.profiles (
    user_id, 
    full_name, 
    role, 
    project_credits, 
    available_invites, 
    badge, 
    invite_code_used
  )
  VALUES (
    new.id,
    'New User',
    'Creator',
    10,
    num_invites,
    invite_badge,
    provided_invite_code
  );
  
  -- Generate invite codes for the new user
  PERFORM generate_invite_codes(new.id, num_invites);
  
  RETURN new;
END;
$function$;