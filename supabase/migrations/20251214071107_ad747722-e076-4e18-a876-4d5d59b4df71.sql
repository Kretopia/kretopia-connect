-- Add RLS policy to allow users to see swipes where they are the TARGET
-- This is CRITICAL for mutual match detection to work
CREATE POLICY "Users can view swipes targeting them"
ON public.swipes
FOR SELECT
TO authenticated
USING (auth.uid() = target_id);

-- Also ensure the connections RLS policy allows for match-based inserts
-- Drop and recreate to ensure clean state
DROP POLICY IF EXISTS "Users can create connections for matches" ON public.connections;

CREATE POLICY "Users can create connections for matches"
ON public.connections
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR 
  (
    -- Allow if there's a mutual right swipe
    EXISTS (
      SELECT 1 FROM swipes s1
      WHERE s1.user_id = auth.uid() 
      AND s1.target_id = connections.user_id 
      AND s1.direction = 'right'
    ) 
    AND 
    EXISTS (
      SELECT 1 FROM swipes s2
      WHERE s2.user_id = connections.user_id 
      AND s2.target_id = auth.uid() 
      AND s2.direction = 'right'
    )
  )
);