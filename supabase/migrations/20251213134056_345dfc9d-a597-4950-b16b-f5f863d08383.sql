-- Allow anonymous users to view basic profile info for public EPK pages
CREATE POLICY "Anonymous users can view public profile info"
ON public.profiles
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to view portfolio items for public EPK
CREATE POLICY "Anonymous users can view portfolio items"
ON public.portfolio_items
FOR SELECT
TO anon
USING (true);