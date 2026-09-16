CREATE OR REPLACE VIEW public.public_profiles_discovery AS
SELECT user_id,
    full_name,
    avatar_url,
    role,
    bio,
    location,
    professional_skills,
    passion_skills,
    badge,
    verification_score,
    level,
    xp,
    account_type,
    company_name,
    company_logo_url,
    job_title,
    industry,
    collab_intent,
    onboarding_completed,
    created_at
   FROM profiles
  WHERE onboarding_completed = true
    AND is_claimed = true
    AND avatar_url IS NOT NULL
    AND avatar_url <> ''
    AND bio IS NOT NULL
    AND length(bio) >= 20
    AND full_name IS NOT NULL
    AND full_name <> 'New User'
    AND full_name <> ''
    AND role IS NOT NULL
    AND role <> 'Creator'
    AND role <> '';