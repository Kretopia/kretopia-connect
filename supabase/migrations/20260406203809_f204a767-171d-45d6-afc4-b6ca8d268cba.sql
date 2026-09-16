
DROP VIEW IF EXISTS public.public_profiles_discovery;
CREATE VIEW public.public_profiles_discovery AS
SELECT 
  p.user_id,
  p.full_name,
  p.role,
  p.bio,
  p.avatar_url,
  p.location,
  p.collab_intent,
  p.level,
  p.verification_score,
  p.badge,
  p.created_at
FROM profiles p
WHERE p.onboarding_completed = true
  AND p.avatar_url IS NOT NULL
  AND p.avatar_url != ''
  AND p.bio IS NOT NULL
  AND LENGTH(p.bio) >= 20
  AND EXISTS (
    SELECT 1 FROM credits c WHERE c.user_id = p.user_id
  );
