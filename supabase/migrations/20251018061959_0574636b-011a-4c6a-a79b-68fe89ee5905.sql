-- Fix foreign key constraint to cascade user deletions
-- Drop the existing constraint
ALTER TABLE public.projects 
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

-- Re-add with CASCADE delete
ALTER TABLE public.projects
ADD CONSTRAINT projects_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id) 
ON DELETE CASCADE;

-- Also fix any other tables that might have this issue
ALTER TABLE public.applications
DROP CONSTRAINT IF EXISTS applications_applicant_id_fkey;

ALTER TABLE public.applications
ADD CONSTRAINT applications_applicant_id_fkey
FOREIGN KEY (applicant_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE public.opportunities
DROP CONSTRAINT IF EXISTS opportunities_created_by_fkey;

ALTER TABLE public.opportunities
ADD CONSTRAINT opportunities_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON DELETE CASCADE;