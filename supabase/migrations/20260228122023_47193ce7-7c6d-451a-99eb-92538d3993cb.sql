
-- Add preferred_currency to profiles (defaults to USD)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_currency TEXT NOT NULL DEFAULT 'USD';
