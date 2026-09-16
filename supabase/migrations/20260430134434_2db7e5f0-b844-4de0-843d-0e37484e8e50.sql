ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS mood text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS client_name text;