
-- Fix last security definer view: public_profiles_safe
DROP VIEW IF EXISTS public.public_profiles_safe;
CREATE VIEW public.public_profiles_safe
WITH (security_invoker = true)
AS
SELECT user_id, full_name, avatar_url, role,
  professional_skills, passion_skills, bio, location,
  subscription_tier, badge, verification_score, level, xp,
  account_type, company_name, company_logo_url,
  collab_intent, job_title, industry
FROM profiles
WHERE onboarding_completed = true;
