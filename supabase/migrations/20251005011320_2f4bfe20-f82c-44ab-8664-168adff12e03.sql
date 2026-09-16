-- Make created_by column NOT NULL since it's required for RLS
-- First update any existing rows with NULL created_by (shouldn't be any, but just in case)
UPDATE public.projects
SET created_by = auth.uid()
WHERE created_by IS NULL;

-- Now make the column NOT NULL
ALTER TABLE public.projects
ALTER COLUMN created_by SET NOT NULL;