CREATE OR REPLACE VIEW public.public_profiles_discovery AS
SELECT p.user_id,
    p.full_name,
    p.avatar_url,
    p.role,
    p.bio,
    p.location,
    p.professional_skills,
    p.passion_skills,
    p.badge,
    p.verification_score,
    p.level,
    p.xp,
    p.account_type,
    p.company_name,
    p.company_logo_url,
    p.job_title,
    p.industry,
    p.collab_intent,
    p.onboarding_completed,
    p.created_at
   FROM profiles p
  WHERE p.onboarding_completed = true
    AND p.is_claimed = true
    AND p.avatar_url IS NOT NULL
    AND p.avatar_url <> ''
    AND p.bio IS NOT NULL
    AND length(p.bio) >= 20
    AND p.full_name IS NOT NULL
    AND p.full_name <> 'New User'
    AND p.full_name <> ''
    AND p.role IS NOT NULL
    AND p.role <> 'Creator'
    AND p.role <> ''
    AND (
      EXISTS (SELECT 1 FROM portfolio_items pi WHERE pi.user_id = p.user_id)
      OR EXISTS (SELECT 1 FROM credits c WHERE c.user_id = p.user_id)
    );