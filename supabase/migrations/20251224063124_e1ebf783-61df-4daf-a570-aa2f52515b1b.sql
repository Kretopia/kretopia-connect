
-- Drop and recreate the view with SECURITY INVOKER to ensure it respects RLS
DROP VIEW IF EXISTS public.skill_endorsement_counts;

CREATE VIEW public.skill_endorsement_counts
WITH (security_invoker = true)
AS
SELECT 
  profile_id,
  skill_name,
  count(*) AS endorsement_count,
  round(avg(
    CASE proficiency_level
      WHEN 'beginner' THEN 1
      WHEN 'intermediate' THEN 2
      WHEN 'advanced' THEN 3
      WHEN 'expert' THEN 4
      ELSE 0
    END
  )) AS average_level
FROM skill_endorsements
GROUP BY profile_id, skill_name;

-- Grant access to anon and authenticated roles
GRANT SELECT ON public.skill_endorsement_counts TO anon;
GRANT SELECT ON public.skill_endorsement_counts TO authenticated;

-- Also ensure skill_endorsements has proper anon SELECT policy (it exists but let's make sure)
-- The existing policy "Public can view endorsement basic info only" should allow this
