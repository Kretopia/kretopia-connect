-- First, let's simplify the RLS policy completely
-- Drop the restrictive policy
DROP POLICY IF EXISTS "authenticated_users_create_projects" ON public.projects;

-- Create a simple policy that lets authenticated users insert
-- We'll use a trigger to enforce created_by automatically
CREATE POLICY "allow_authenticated_insert" 
ON public.projects
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create a trigger function that automatically sets created_by
CREATE OR REPLACE FUNCTION public.set_project_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically set created_by to the current user
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set created_by before insert
DROP TRIGGER IF EXISTS set_project_created_by_trigger ON public.projects;
CREATE TRIGGER set_project_created_by_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_created_by();