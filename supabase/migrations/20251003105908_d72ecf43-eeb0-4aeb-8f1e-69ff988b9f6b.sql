-- Update handle_new_user to consume invite code properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_badge public.user_badge;
  invite_code_used text;
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
    ELSE
      invite_badge := 'beta';
    END IF;
  ELSE
    -- Default badge if no invite code
    invite_badge := 'beta';
  END IF;

  -- Create profile
  INSERT INTO public.profiles (user_id, full_name, role, project_credits, available_invites, badge, invite_code_used)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'Creator'),
    10,
    5,
    invite_badge,
    invite_code_used
  );
  
  -- Generate 5 invite codes for the new user
  PERFORM generate_invite_codes(new.id, 5);
  
  RETURN new;
END;
$$;