
-- Remove old permissive INSERT policies on skill_endorsements that override our new restrictive one
DROP POLICY IF EXISTS "Allow authenticated to insert skill endorsements" ON skill_endorsements;
DROP POLICY IF EXISTS "Anonymous users can insert skill endorsements" ON skill_endorsements;
