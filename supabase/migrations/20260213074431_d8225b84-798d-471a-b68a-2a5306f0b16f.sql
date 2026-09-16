-- Allow created_by to be nullable for guest opportunities
ALTER TABLE public.opportunities ALTER COLUMN created_by DROP NOT NULL;