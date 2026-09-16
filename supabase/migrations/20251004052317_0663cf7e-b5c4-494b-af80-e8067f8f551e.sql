-- Update generate_invite_codes function to give 10 codes instead of 5
CREATE OR REPLACE FUNCTION public.generate_invite_codes(user_id_param uuid, num_codes integer DEFAULT 10)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  FOR i IN 1..num_codes LOOP
    INSERT INTO public.invites (inviter_id, invitee_email, status)
    VALUES (user_id_param, '', 'pending');
  END LOOP;
END;
$function$;

-- Update handle_new_user to give OG users 100 invites and regular users 10
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invite_badge public.user_badge;
  invite_code_used text;
  num_invites integer;
BEGIN
  -- Get the invite code from user metadata
  invite_code_used := new.raw_user_meta_data->>'invite_code';
  
  -- Consume the invite code and get badge
  IF invite_code_used IS NOT NULL AND invite_code_used != '' THEN
    -- Use the invite code (this increments usage and updates status)
    PERFORM use_invite_code(invite_code_used, new.email);
    
    -- Get the inviter's badge
    SELECT COALESCE(p.badge, 'beta')
    INTO invite_badge
    FROM public.invites i
    JOIN public.profiles p ON p.user_id = i.inviter_id
    WHERE i.invite_code = invite_code_used
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

  -- Create profile with appropriate invite count
  INSERT INTO public.profiles (user_id, full_name, role, project_credits, available_invites, badge, invite_code_used)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'Creator'),
    10,
    num_invites,
    invite_badge,
    invite_code_used
  );
  
  -- Generate invite codes for the new user
  PERFORM generate_invite_codes(new.id, num_invites);
  
  RETURN new;
END;
$function$;