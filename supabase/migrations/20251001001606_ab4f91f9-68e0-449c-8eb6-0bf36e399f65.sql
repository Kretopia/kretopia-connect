-- Drop the overly permissive public SELECT policy on industry_stats
DROP POLICY IF EXISTS "Industry stats are viewable by everyone" ON public.industry_stats;

-- Create a new policy that requires authentication to view industry stats
CREATE POLICY "Authenticated users can view industry stats"
ON public.industry_stats
FOR SELECT
TO authenticated
USING (true);