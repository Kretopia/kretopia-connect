-- Fix handle_new_user to properly assign OG badge from inviter
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
  inviter_badge public.user_badge;
BEGIN
  -- Get the invite code from user metadata
  provided_invite_code := new.raw_user_meta_data->>'invite_code';
  
  -- Check invite code and get inviter's badge FIRST
  IF provided_invite_code IS NOT NULL AND provided_invite_code != '' THEN
    -- Get the inviter's badge BEFORE consuming the invite
    SELECT p.badge INTO inviter_badge
    FROM public.invites i
    JOIN public.profiles p ON p.user_id = i.inviter_id
    WHERE LOWER(i.invite_code) = LOWER(provided_invite_code)
    AND i.current_uses < i.max_uses
    LIMIT 1;
    
    -- Assign badge based on inviter's badge
    IF inviter_badge = 'og' THEN
      invite_badge := 'og';
      num_invites := 100;
    ELSE
      invite_badge := 'beta';
      num_invites := 10;
    END IF;
    
    -- Now consume the invite code with the new user's ID
    PERFORM use_invite_code(provided_invite_code, new.email, new.id);
  ELSE
    -- Default badge if no invite code
    invite_badge := 'beta';
    num_invites := 10;
  END IF;

  -- Create profile with correct badge
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