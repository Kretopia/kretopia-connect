
-- Add rate card fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS hourly_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS project_rate numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rate_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS avg_response_hours numeric DEFAULT NULL;
