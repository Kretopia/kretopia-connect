
-- Fix endorsement policy to handle "All Skills" requests
DROP POLICY IF EXISTS "Endorsements require valid pending request" ON skill_endorsements;

CREATE POLICY "Endorsements require valid pending request"
ON skill_endorsements FOR INSERT
TO authenticated, anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM skill_endorsement_requests ser
    WHERE ser.profile_id = skill_endorsements.profile_id
      AND (ser.skill_name = skill_endorsements.skill_name OR ser.skill_name = 'All Skills')
      AND ser.status = 'pending'
      AND ser.expires_at > now()
  )
);
