-- Add calendly_url field for booking integration
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS calendly_url TEXT;