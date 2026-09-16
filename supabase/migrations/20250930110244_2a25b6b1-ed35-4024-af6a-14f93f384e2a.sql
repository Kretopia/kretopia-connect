-- Allow anonymous opportunity posting with moderation
-- Update RLS policy to allow inserts without auth for opportunities

DROP POLICY IF EXISTS "Users can create opportunities" ON public.opportunities;

CREATE POLICY "Anyone can create opportunities"
ON public.opportunities
FOR INSERT
WITH CHECK (true);

-- Add created_by as nullable since posting can be anonymous
ALTER TABLE public.opportunities 
ALTER COLUMN created_by DROP NOT NULL;