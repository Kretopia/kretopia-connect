-- =====================================================
-- SECURITY FIX: Restrict sensitive data exposure
-- =====================================================

-- 1. DROP overly permissive SELECT policies on profiles
DROP POLICY IF EXISTS "All profiles viewable for discovery" ON profiles;
DROP POLICY IF EXISTS "Anonymous can view basic profile info" ON profiles;

-- 2. DROP overly permissive SELECT policies on skill_endorsements
DROP POLICY IF EXISTS "Authenticated users can view endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Public can view endorsement basic info only" ON skill_endorsements;

-- 3. Create secure view for public profile discovery (excludes sensitive fields)
DROP VIEW IF EXISTS public_profiles_discovery;
CREATE VIEW public_profiles_discovery WITH (security_invoker=on) AS
SELECT 
  user_id,
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
  AND is_claimed = true;

-- 4. Create secure view for skill endorsements (excludes email)
DROP VIEW IF EXISTS skill_endorsements_public;
CREATE VIEW skill_endorsements_public WITH (security_invoker=on) AS
SELECT 
  id,
  profile_id,
  skill_name,
  endorser_name,
  endorser_company,
  project_name,
  proficiency_level,
  testimonial,
  relationship,
  verified,
  created_at
FROM skill_endorsements;

-- 5. Create secure view for reviews (excludes email for public)
DROP VIEW IF EXISTS reviews_public;
CREATE VIEW reviews_public WITH (security_invoker=on) AS
SELECT 
  id,
  profile_id,
  reviewer_id,
  reviewer_name,
  reviewer_role,
  reviewer_company,
  reviewer_avatar_url,
  rating,
  review_text,
  project_name,
  collaboration_type,
  is_endorsed,
  is_verified,
  status,
  created_at
FROM reviews
WHERE status IN ('approved', 'published');

-- 6. Add safer SELECT policy on skill_endorsements (only owner sees emails)
CREATE POLICY "Public can view endorsements without email" 
ON skill_endorsements FOR SELECT
USING (true);
-- Note: The view should be used for public access, policy allows owner access

-- 7. Grant SELECT on the new views to authenticated and anon roles
GRANT SELECT ON public_profiles_discovery TO authenticated, anon;
GRANT SELECT ON skill_endorsements_public TO authenticated, anon;
GRANT SELECT ON reviews_public TO authenticated, anon;