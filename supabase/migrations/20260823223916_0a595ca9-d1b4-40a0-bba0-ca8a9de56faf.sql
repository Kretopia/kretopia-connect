CREATE OR REPLACE FUNCTION public.set_age_verified_from_dob()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    NEW.age_verified := NEW.date_of_birth IS NOT NULL
      AND NEW.date_of_birth <= (current_date - interval '18 years');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_age_verified ON public.profiles;
CREATE TRIGGER trg_set_age_verified
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_age_verified_from_dob();