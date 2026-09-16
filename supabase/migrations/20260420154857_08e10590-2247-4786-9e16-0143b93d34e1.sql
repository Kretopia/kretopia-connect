-- Add claimed tracking columns to guest_rsvps if not present
ALTER TABLE public.guest_rsvps
  ADD COLUMN IF NOT EXISTS claimed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_guest_rsvps_email_lower ON public.guest_rsvps (lower(guest_email));

-- Function: when a new auth user is created, merge any guest RSVPs with the same email
CREATE OR REPLACE FUNCTION public.merge_guest_rsvps_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert matching guest RSVPs into jam_participants (skip duplicates)
  INSERT INTO public.jam_participants (jam_id, user_id, status)
  SELECT g.event_id, NEW.id, 'going'
  FROM public.guest_rsvps g
  WHERE lower(g.guest_email) = lower(NEW.email)
    AND g.claimed_by_user_id IS NULL
  ON CONFLICT (jam_id, user_id) DO NOTHING;

  -- Mark guest RSVPs as claimed
  UPDATE public.guest_rsvps
  SET claimed_by_user_id = NEW.id,
      claimed_at = now()
  WHERE lower(guest_email) = lower(NEW.email)
    AND claimed_by_user_id IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup on merge errors
  RAISE WARNING 'merge_guest_rsvps_on_signup failed for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_merge_guest_rsvps ON auth.users;
CREATE TRIGGER on_auth_user_merge_guest_rsvps
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.merge_guest_rsvps_on_signup();