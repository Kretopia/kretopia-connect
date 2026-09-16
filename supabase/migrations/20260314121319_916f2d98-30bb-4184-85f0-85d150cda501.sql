-- Allow anonymous users to view public events/sessions (for shareable event pages)
CREATE POLICY "Public events visible to everyone"
ON public.creative_jams FOR SELECT
TO anon
USING (is_public = true);

-- Allow anonymous users to see participant counts for public events
CREATE POLICY "Public event participants visible to everyone"
ON public.jam_participants FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams 
    WHERE id = jam_id AND is_public = true
  )
);

-- Allow anon to read profiles for event creator info
-- (public_profiles_safe view already has anon access from previous migration)