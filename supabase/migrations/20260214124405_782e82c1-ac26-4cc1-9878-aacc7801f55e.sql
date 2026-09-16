-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view comments on visible posts" ON public.feed_comments;

-- Create a permissive SELECT policy - all authenticated users can read comments
CREATE POLICY "Anyone can view comments"
ON public.feed_comments
FOR SELECT
USING (true);