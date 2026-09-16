
-- Function to increment endorsement count when a credit is endorsed
CREATE OR REPLACE FUNCTION public.increment_endorsement_count(credit_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE credits
  SET endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        WHEN COALESCE(endorsement_count, 0) + 1 >= 1 THEN 'pending'
        ELSE verification_status
      END
  WHERE id = credit_id_param;
END;
$$;

-- Make credits table readable by all authenticated users for the public database
CREATE POLICY "Anyone can read credits" ON public.credits
  FOR SELECT TO authenticated USING (true);
