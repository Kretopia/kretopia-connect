-- Drop existing policy and create a more permissive one
DROP POLICY IF EXISTS "Anyone can view public communities" ON communities;

-- Allow everyone (authenticated and unauthenticated) to view public communities
CREATE POLICY "Public communities viewable by all"
ON communities
FOR SELECT
USING (
  is_private = false 
  OR 
  (auth.uid() IS NOT NULL AND id IN (
    SELECT community_id 
    FROM community_members 
    WHERE user_id = auth.uid()
  ))
);

-- Also ensure member_count is accurate
UPDATE communities 
SET member_count = (
  SELECT COUNT(*) 
  FROM community_members 
  WHERE community_id = communities.id
)
WHERE id IN (
  SELECT id FROM communities
);