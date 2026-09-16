-- Add trigger to automatically set created_by for tasks

CREATE OR REPLACE FUNCTION public.set_task_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_task_created_by_trigger ON public.project_tasks;
CREATE TRIGGER set_task_created_by_trigger
  BEFORE INSERT ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_created_by();

-- Simplify the INSERT policy since trigger handles created_by
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can create tasks in their projects"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    user_has_project_access(project_id, auth.uid())
  )
);