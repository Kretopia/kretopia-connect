
-- Create a trigger function that awards XP to the inviter when an invite code is used
CREATE OR REPLACE FUNCTION public.award_invite_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inviter_profile RECORD;
BEGIN
  -- Only trigger when current_uses increases (someone used the code)
  IF NEW.current_uses > OLD.current_uses THEN
    -- Get inviter's current XP
    SELECT xp INTO inviter_profile
    FROM public.profiles
    WHERE user_id = NEW.inviter_id;

    IF FOUND THEN
      -- Award 200 XP to the inviter
      UPDATE public.profiles
      SET xp = COALESCE(inviter_profile.xp, 0) + 200
      WHERE user_id = NEW.inviter_id;

      -- Record the XP activity
      INSERT INTO public.xp_activities (user_id, activity_type, xp_earned, description)
      VALUES (
        NEW.inviter_id,
        'invite_accepted',
        200,
        'Someone joined using your invite code!'
      );

      -- Create a notification for the inviter
      PERFORM public.create_notification(
        NEW.inviter_id,
        'Invite Accepted! 🎉',
        'Someone joined ThriveIN using your invite code! You earned +200 XP',
        'reward',
        '/rewards',
        '/rewards',
        'View Rewards',
        NULL,
        'high',
        'reward'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger on the invites table
DROP TRIGGER IF EXISTS on_invite_used_award_xp ON public.invites;
CREATE TRIGGER on_invite_used_award_xp
  AFTER UPDATE ON public.invites
  FOR EACH ROW
  EXECUTE FUNCTION public.award_invite_xp();
