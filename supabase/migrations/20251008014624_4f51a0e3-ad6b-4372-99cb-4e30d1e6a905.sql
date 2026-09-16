-- Update all users who used the "thriveogs" invite code to have OG badge
UPDATE profiles
SET badge = 'og'::user_badge
WHERE LOWER(invite_code_used) = 'thriveogs'
AND badge = 'beta'::user_badge;