-- Tighten opportunity_views INSERT policy: require authenticated users or allow anon with rate limiting via viewer_id
DROP POLICY IF EXISTS "Anyone can record a view" ON public.opportunity_views;

CREATE POLICY "Authenticated users can record views"
ON public.opportunity_views
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND viewer_id = auth.uid());

-- Also allow anonymous view tracking but require viewer_id to be null (for unauthenticated visitors)
CREATE POLICY "Anonymous users can record views"
ON public.opportunity_views
FOR INSERT
WITH CHECK (auth.uid() IS NULL AND viewer_id IS NULL);