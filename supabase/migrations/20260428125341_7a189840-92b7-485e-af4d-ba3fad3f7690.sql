-- Allow anyone (incl. anonymous) to read an unclaimed scouted event via its claim token link
DROP POLICY IF EXISTS "Anyone can read unclaimed scouted events" ON public.creative_jams;
CREATE POLICY "Anyone can read unclaimed scouted events"
ON public.creative_jams
FOR SELECT
USING (claim_status = 'unclaimed' AND claim_token IS NOT NULL);

-- Allow an authenticated user to claim an unclaimed scouted event by setting themselves as creator
DROP POLICY IF EXISTS "Authenticated users can claim unclaimed events" ON public.creative_jams;
CREATE POLICY "Authenticated users can claim unclaimed events"
ON public.creative_jams
FOR UPDATE
TO authenticated
USING (claim_status = 'unclaimed')
WITH CHECK (created_by = auth.uid() AND claim_status = 'claimed');