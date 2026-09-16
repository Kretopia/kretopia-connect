
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS action_taken text;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
