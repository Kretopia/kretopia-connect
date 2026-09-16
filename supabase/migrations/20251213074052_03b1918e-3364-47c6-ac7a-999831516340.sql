-- Allow anonymous users to insert skill endorsements (for public endorsement links)
CREATE POLICY "Anonymous users can insert skill endorsements"
ON public.skill_endorsements
FOR INSERT
TO anon
WITH CHECK (true);