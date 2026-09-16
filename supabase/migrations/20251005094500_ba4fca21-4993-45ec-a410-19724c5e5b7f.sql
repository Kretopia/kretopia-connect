-- Fix ambiguous column reference in handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
DECLARE
  invite_badge public.user_badge;
  provided_invite_code text;  -- Renamed to avoid ambiguity with column name
  num_invites integer;
BEGIN
  -- Get the invite code from user metadata
  provided_invite_code := new.raw_user_meta_data->>'invite_code';
  
  -- Consume the invite code and get badge
  IF provided_invite_code IS NOT NULL AND provided_invite_code != '' THEN
    -- Use the invite code (this increments usage and updates status)
    PERFORM use_invite_code(provided_invite_code, new.email);
    
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

  -- Create profile with appropriate invite count
  INSERT INTO public.profiles (user_id, full_name, role, project_credits, available_invites, badge, invite_code_used)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'Creator'),
    10,
    num_invites,
    invite_badge,
    provided_invite_code  -- Use the renamed variable
  );
  
  -- Generate invite codes for the new user
  PERFORM generate_invite_codes(new.id, num_invites);
  
  RETURN new;
END;
$$;