-- Add badge system to profiles
CREATE TYPE public.user_badge AS ENUM ('og', 'beta', 'official');

ALTER TABLE public.profiles 
ADD COLUMN badge public.user_badge DEFAULT 'beta';

-- Set the current user as OG (you can adjust this to set specific users as OG)
-- For now, we'll just add the column and you can manually set OG users

-- Update the use_invite_code function to handle badge assignment
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  invite_record RECORD;
  inviter_badge public.user_badge;
  new_user_badge public.user_badge;
BEGIN
  -- Find unused invite code
  SELECT * INTO invite_record
  FROM public.invites
  WHERE invite_code = code
  AND status = 'pending'
  AND used_by IS NULL
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

  -- Mark invite as used
  UPDATE public.invites
  SET 
    invitee_email = user_email,
    status = 'accepted',
    used_at = now()
  WHERE id = invite_record.id;

  -- Store the badge for when the profile is created
  -- We'll update the handle_new_user function to use this
  UPDATE public.invites
  SET invitee_user_id = (SELECT id FROM auth.users WHERE email = user_email LIMIT 1)
  WHERE id = invite_record.id;

  RETURN TRUE;
END;
$function$;

-- Update handle_new_user to assign badge based on invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  invite_badge public.user_badge;
BEGIN
  -- Check if user was invited and get the badge from their inviter
  SELECT COALESCE(p.badge, 'beta')
  INTO invite_badge
  FROM public.invites i
  JOIN public.profiles p ON p.user_id = i.inviter_id
  WHERE i.invitee_email = new.email
  AND i.status = 'accepted'
  LIMIT 1;

  -- If inviter has OG badge, new user gets OG, otherwise Beta
  IF invite_badge = 'og' THEN
    invite_badge := 'og';
  ELSE
    invite_badge := 'beta';
  END IF;

  INSERT INTO public.profiles (user_id, full_name, role, credits, available_invites, badge)
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