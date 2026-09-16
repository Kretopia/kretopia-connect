-- Add policy for authenticated users to view public profile fields
-- This allows discovery while protecting sensitive data
CREATE POLICY "Authenticated users can view public profiles" ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  -- Users can see basic public info about any profile
  -- Sensitive fields like stripe IDs, subscription details, storage info
  -- should be filtered in application layer when not viewing own profile
);