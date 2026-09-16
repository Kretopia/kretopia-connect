-- Drop the existing INSERT policy that's too permissive
DROP POLICY IF EXISTS "System can create projects" ON public.projects;

-- Create a proper INSERT policy that checks created_by matches the authenticated user
CREATE POLICY "Users can create their own projects" 
ON public.projects
FOR INSERT 
TO public
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND created_by = auth.uid()
);