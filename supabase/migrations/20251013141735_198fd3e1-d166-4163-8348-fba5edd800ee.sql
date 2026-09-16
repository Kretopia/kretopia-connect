-- Add endorsement count tracking to skill endorsements
-- This allows us to display how many endorsements each skill has received

-- First, let's add a view to aggregate endorsement counts per skill
CREATE OR REPLACE VIEW skill_endorsement_counts AS
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

-- Grant access to authenticated users to view endorsement counts
GRANT SELECT ON skill_endorsement_counts TO authenticated;
GRANT SELECT ON skill_endorsement_counts TO anon;