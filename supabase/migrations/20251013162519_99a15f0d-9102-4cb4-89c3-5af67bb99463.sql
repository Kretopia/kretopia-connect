-- Fix skill_endorsement_counts view to use security_invoker
DROP VIEW IF EXISTS public.skill_endorsement_counts CASCADE;
CREATE VIEW public.skill_endorsement_counts
WITH (security_invoker = true)
AS
SELECT 
  profile_id,
  skill_name,
  COUNT(*) as endorsement_count,
  ROUND(AVG(
    CASE proficiency_level
      WHEN 'beginner' THEN 1
      WHEN 'intermediate' THEN 2
      WHEN 'advanced' THEN 3
      WHEN 'expert' THEN 4
      ELSE 0
    END
  )) as average_level
FROM skill_endorsements
GROUP BY profile_id, skill_name;