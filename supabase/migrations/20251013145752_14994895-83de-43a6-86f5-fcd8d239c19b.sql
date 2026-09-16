-- Allow anyone to insert skill endorsements (public endorsement feature)
CREATE POLICY "Allow public to insert skill endorsements"
ON public.skill_endorsements
FOR INSERT
TO public
WITH CHECK (true);