-- Complete rebuild of projects table RLS policies - drop all existing first

-- 1. Drop ALL existing policies on projects table (comprehensive list)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.projects';
    END LOOP;
END $$;

-- 2. Ensure trigger function is correct
CREATE OR REPLACE FUNCTION public.set_project_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always set created_by to the authenticated user
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

-- 3. Ensure trigger exists
DROP TRIGGER IF EXISTS set_project_created_by_trigger ON public.projects;
CREATE TRIGGER set_project_created_by_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_created_by();

-- 4. Create comprehensive new RLS policies

-- INSERT: Any authenticated user can create a project (trigger sets created_by)
CREATE POLICY "Authenticated users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users can view projects they created, are in matches for, or are collaborators on
CREATE POLICY "Users can view accessible projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  auth.uid() = created_by OR
  user_has_project_access(id, auth.uid())
);

-- UPDATE: Users can update projects they have access to
CREATE POLICY "Users can update accessible projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by OR
  user_has_project_access(id, auth.uid())
);

-- DELETE: Only project creators can delete
CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);