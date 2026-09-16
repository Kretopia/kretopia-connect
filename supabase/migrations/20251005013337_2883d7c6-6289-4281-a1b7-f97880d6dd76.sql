-- Fix the RLS policies for projects table
-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "allow_authenticated_insert" ON public.projects;

-- Create a proper INSERT policy that works with the trigger
CREATE POLICY "Users can create their own projects" 
ON public.projects
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Ensure the trigger function is set correctly
-- The trigger will automatically set created_by = auth.uid()
-- So we just need to verify the user is authenticated