
-- Add 'requested' status to milestones for collaborator-initiated payment requests
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS milestones_status_check;
ALTER TABLE public.milestones ADD CONSTRAINT milestones_status_check
  CHECK (status = ANY (ARRAY['requested'::text, 'pending'::text, 'in_progress'::text, 'submitted'::text, 'approved'::text, 'paid'::text]));

-- Add requested_by to track who asked (collaborator) — created_by stays as the row author
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES public.profiles(user_id);

-- Allow project collaborators (non-owners) to insert a 'requested' milestone for their project
DROP POLICY IF EXISTS "Collaborators can request payment" ON public.milestones;
CREATE POLICY "Collaborators can request payment"
  ON public.milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND status = 'requested'
    AND requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = milestones.project_id
        AND pc.user_id = auth.uid()
        AND pc.status = 'accepted'
    )
  );
