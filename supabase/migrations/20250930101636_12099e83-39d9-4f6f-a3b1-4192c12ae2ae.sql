-- Fix search_path for calculate_level function
CREATE OR REPLACE FUNCTION public.calculate_level(xp INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Level = floor(sqrt(xp / 100)) + 1
  -- This means: Level 1: 0-99 XP, Level 2: 100-399 XP, Level 3: 400-899 XP, etc.
  RETURN FLOOR(SQRT(xp / 100.0)) + 1;
END;
$$;