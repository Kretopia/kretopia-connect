-- Allow any accepted project member (not just the owner) to invite new collaborators.
-- Owner-only DELETE / UPDATE policies remain in place.

DROP POLICY IF EXISTS "Project owners can invite collaborators" ON public.project_collaborators;

CREATE POLICY "Project members can invite collaborators"
ON public.project_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  -- The inviter must be the project owner OR an accepted member of the project.
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_collaborators.project_id
      AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
  )
);