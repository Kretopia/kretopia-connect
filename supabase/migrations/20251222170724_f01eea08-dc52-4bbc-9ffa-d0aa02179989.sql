-- Fix email exposure issues in skill_endorsements and reviews tables

-- Drop the existing view first before recreating
DROP VIEW IF EXISTS skill_endorsements_public CASCADE;

-- Create a secure view that hides endorser_email from public
CREATE VIEW skill_endorsements_public AS
SELECT 
  id,
  profile_id,
  request_id,
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

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON skill_endorsements_public TO anon;
GRANT SELECT ON skill_endorsements_public TO authenticated;

-- Drop the existing public_reviews view and recreate
DROP VIEW IF EXISTS public_reviews CASCADE;

-- Create a secure view for public reviews that hides email
CREATE VIEW public_reviews AS
SELECT 
  id,
  profile_id,
  reviewer_id,
  rating,
  is_endorsed,
  is_verified,
  created_at,
  updated_at,
  reviewer_name,
  reviewer_role,
  reviewer_company,
  reviewer_avatar_url,
  review_text,
  project_name,
  collaboration_type,
  status
FROM reviews
WHERE status = 'approved';

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public_reviews TO anon;
GRANT SELECT ON public_reviews TO authenticated;