-- Comprehensive fix for projects table permissions

-- 1. Grant table-level permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 2. Ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.set_project_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set created_by if it's NULL or doesn't match the authenticated user
  IF NEW.created_by IS NULL OR NEW.created_by != auth.uid() THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS set_project_created_by_trigger ON public.projects;
CREATE TRIGGER set_project_created_by_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_created_by();

-- 4. Update the INSERT policy to work with authenticated role
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
CREATE POLICY "Users can create their own projects" 
ON public.projects
FOR INSERT 
TO authenticated
WITH CHECK (true);