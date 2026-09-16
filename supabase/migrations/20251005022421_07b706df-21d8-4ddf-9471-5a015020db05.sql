-- Simplify UPDATE policy to match INSERT policy and avoid permission errors
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can update tasks in their projects"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
  user_has_project_access(project_id, auth.uid())
)
WITH CHECK (
  user_has_project_access(project_id, auth.uid())
);