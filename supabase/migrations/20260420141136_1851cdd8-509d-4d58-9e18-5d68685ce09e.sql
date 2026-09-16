CREATE OR REPLACE FUNCTION public.assign_og_badge_if_under_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.badge IS NULL THEN
    IF (SELECT COUNT(*) FROM public.profiles) < 1000 THEN
      NEW.badge := 'og'::user_badge;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_og_badge ON public.profiles;
CREATE TRIGGER trg_assign_og_badge
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_og_badge_if_under_cap();