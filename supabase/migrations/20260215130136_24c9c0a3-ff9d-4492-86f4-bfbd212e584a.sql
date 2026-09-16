-- Drop the old restrictive insert policy
DROP POLICY "Users can create invoices for their projects" ON public.invoices;

-- Create a new policy that allows standalone invoices (no project) OR project-linked invoices
CREATE POLICY "Users can create invoices" ON public.invoices
FOR INSERT WITH CHECK (
  auth.uid() = issued_by
  AND (
    project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = invoices.project_id
      AND user_has_project_access(p.id, auth.uid())
    )
  )
);