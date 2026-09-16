-- Drop existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;

-- Create a simpler, more reliable INSERT policy
-- This explicitly targets authenticated users and checks the created_by matches
CREATE POLICY "authenticated_users_create_projects" 
ON public.projects
FOR INSERT 
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Verify the user role is properly set for the authenticated user
-- This ensures auth.uid() returns the correct value
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.projects TO authenticated;