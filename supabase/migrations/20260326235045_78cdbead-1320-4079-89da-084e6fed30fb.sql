
-- Function to increment manager total_earned
CREATE OR REPLACE FUNCTION public.increment_manager_earnings(manager_id_input UUID, amount_input NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE talent_managers
  SET total_earned = total_earned + amount_input,
      updated_at = now()
  WHERE id = manager_id_input;
END;
$$;
