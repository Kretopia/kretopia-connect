-- Update all existing profiles to OG badge
UPDATE public.profiles SET badge = 'og';

-- Update handle_new_user function to default new users to OG
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  invite_badge public.user_badge;
BEGIN
  -- Check if user was invited and get the badge from their inviter
  SELECT COALESCE(p.badge, 'og')
  INTO invite_badge
  FROM public.invites i
  JOIN public.profiles p ON p.user_id = i.inviter_id
  WHERE i.invitee_email LIKE '%' || new.email || '%'
  LIMIT 1;

  -- If inviter has OG badge, new user gets OG, otherwise default to OG
  IF invite_badge = 'og' THEN
    invite_badge := 'og';
  ELSE
    invite_badge := 'og';  -- Default everyone to OG now
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, project_credits, available_invites, badge)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'Creator'),
    10,
    5,
    invite_badge
  );
  
  -- Generate 5 invite codes for the new user
  PERFORM generate_invite_codes(new.id, 5);
  
  RETURN new;
END;
$function$;