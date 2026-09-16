-- Fix feed_posts RLS policy to allow viewing all posts for Spark feed
-- Drop the restrictive policy that only shows posts from connections
DROP POLICY IF EXISTS "Users can view posts from connections" ON public.feed_posts;

-- Create a new policy that allows all authenticated users to view all posts
-- This makes Spark work as a proper content feed
CREATE POLICY "Authenticated users can view all posts" 
ON public.feed_posts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Comment explaining the change
COMMENT ON POLICY "Authenticated users can view all posts" ON public.feed_posts IS 
'Allows all authenticated users to view all posts in the Spark feed. Users can still only create/update/delete their own posts.';