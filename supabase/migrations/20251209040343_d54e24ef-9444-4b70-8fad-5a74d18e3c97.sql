-- Drop existing function first
DROP FUNCTION IF EXISTS public.get_endorsement_request_by_token(TEXT);

-- Create a function to get endorsement request by token (for anonymous access)
CREATE OR REPLACE FUNCTION public.get_endorsement_request_by_token(token_param TEXT)
RETURNS TABLE(
  id UUID,
  profile_id UUID,
  skill_name TEXT,
  personal_message TEXT,
  share_token TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ser.id,
    ser.profile_id,
    ser.skill_name,
    ser.personal_message,
    ser.share_token,
    ser.created_at
  FROM skill_endorsement_requests ser
  WHERE ser.share_token = token_param;
END;
$$;