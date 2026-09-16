-- Fix: Allow pending_verification status
ALTER TABLE public.opportunities DROP CONSTRAINT opportunities_status_check;
ALTER TABLE public.opportunities ADD CONSTRAINT opportunities_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'closed'::text, 'draft'::text, 'pending_verification'::text]));

-- Add location_city and location_country columns for richer location data
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS location_country text;

-- Add image_url for opportunity cover/banner image
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS image_url text;