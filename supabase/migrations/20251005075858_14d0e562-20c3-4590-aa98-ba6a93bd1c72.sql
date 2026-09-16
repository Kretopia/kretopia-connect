-- Create security definer function to get user email
CREATE OR REPLACE FUNCTION public.get_user_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = _user_id;
$$;

-- Drop and recreate the problematic RLS policy
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.partner_submissions;

CREATE POLICY "Users can view their own submissions"
ON public.partner_submissions
FOR SELECT
USING (contact_email = public.get_user_email(auth.uid()));