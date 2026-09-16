
CREATE POLICY "Event hosts can update check-in status"
ON public.jam_participants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.creative_jams
    WHERE id = jam_participants.jam_id
    AND created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.creative_jams
    WHERE id = jam_participants.jam_id
    AND created_by = auth.uid()
  )
);
