-- Drop the problematic policy that references auth.users directly
DROP POLICY IF EXISTS "Users can view their own claim requests" ON profile_claim_requests;

-- Recreate it without directly querying auth.users (use a function instead)
CREATE POLICY "Users can view their own claim requests" 
ON profile_claim_requests
FOR SELECT
USING (
  claimant_user_id = auth.uid()
);

-- Note: We removed the email check because it was causing the permission issue
-- Users must be logged in to view their claim requests (via claimant_user_id)