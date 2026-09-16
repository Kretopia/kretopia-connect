-- Simplify SELECT policy to match INSERT policy logic  
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can view tasks in their projects"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
  user_has_project_access(project_id, auth.uid())
);