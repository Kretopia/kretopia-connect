-- Update existing users invited by OG users to have OG badge
-- First, update users who were directly invited by OG users
UPDATE profiles
SET badge = 'og'::user_badge
WHERE user_id IN (
  SELECT i.used_by
  FROM invites i
  JOIN profiles p ON p.user_id = i.inviter_id
  WHERE p.badge = 'og'
  AND i.used_by IS NOT NULL
)
AND badge = 'beta'::user_badge;