CREATE OR REPLACE FUNCTION public.increment_promo_use(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.event_promo_codes SET uses_count = uses_count + 1 WHERE id = _id;
$$;