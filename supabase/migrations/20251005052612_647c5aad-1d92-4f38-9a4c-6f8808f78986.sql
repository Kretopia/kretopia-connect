-- Allow users to view basic profile information of all users
-- This enables the Connect page to show all available profiles
CREATE POLICY "Users can view all profiles for discovery"
  ON profiles
  FOR SELECT
  USING (
    -- Always allow viewing basic profile info for discovery/connect features
    true
  );