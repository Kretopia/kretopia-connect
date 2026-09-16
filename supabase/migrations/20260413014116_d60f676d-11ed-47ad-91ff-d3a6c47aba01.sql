-- Allow collaborators to accept their own pending invitations
CREATE POLICY "Collaborators can accept own invitation"
ON public.project_collaborators
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending')
WITH CHECK (user_id = auth.uid() AND status = 'accepted');

-- Clean up duplicate pending invitations (keep only the latest one per user+project)
DELETE FROM project_collaborators pc1
WHERE pc1.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM project_collaborators pc2
    WHERE pc2.project_id = pc1.project_id
      AND pc2.user_id = pc1.user_id
      AND pc2.status = 'pending'
      AND pc2.created_at > pc1.created_at
  );