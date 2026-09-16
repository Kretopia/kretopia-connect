-- Warning flagged by the deep security scan: "Users can award themselves
-- arbitrary loyalty points on check-in."
--
-- "The INSERT policy on 'user_check_ins' only validates that user_id =
-- auth.uid(), but does not validate the points_awarded value or
-- verified_location against server-calculated values, so a user can insert
-- check-ins granting themselves unlimited loyalty points. Compute and set
-- points_awarded server-side (e.g. via edge function/service role) rather
-- than trusting client-submitted values."
--
-- Confirmed via grep: all three call sites (QRScanner.tsx, NFCScanner.tsx,
-- CheckIn.tsx) insert points_awarded straight from the client's own copy of
-- partner_locations.points_per_visit — trivially replayable with any value
-- via a direct API call. Rather than rewriting all three call sites onto a
-- new RPC, force points_awarded (and location_id-derived validity) to the
-- server's own value with a BEFORE INSERT trigger, so client-submitted
-- points_awarded is always discarded and replaced with the real rate for
-- that location, regardless of what was sent.

CREATE OR REPLACE FUNCTION public.enforce_check_in_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _points integer;
BEGIN
  SELECT points_per_visit INTO _points
  FROM public.partner_locations
  WHERE id = NEW.location_id;

  IF _points IS NULL THEN
    RAISE EXCEPTION 'Invalid check-in location';
  END IF;

  NEW.points_awarded := _points;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_check_in_points ON public.user_check_ins;
CREATE TRIGGER trg_enforce_check_in_points
  BEFORE INSERT ON public.user_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_check_in_points();
