-- Create a function to validate invite codes without consuming them
CREATE OR REPLACE FUNCTION public.validate_invite_code(code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Find invite code that still has uses left
  SELECT * INTO invite_record
  FROM public.invites
  WHERE invite_code = code
  AND current_uses < max_uses
  LIMIT 1;

  RETURN FOUND;
END;
$$;