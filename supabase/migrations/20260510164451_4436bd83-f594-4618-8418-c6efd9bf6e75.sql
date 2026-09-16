ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_vibe text NOT NULL DEFAULT 'daylight'
  CHECK (ui_vibe IN ('daylight','midnight','neon'));