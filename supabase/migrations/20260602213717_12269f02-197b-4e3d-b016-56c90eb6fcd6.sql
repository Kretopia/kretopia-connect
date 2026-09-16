ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS model_stats jsonb,
  ADD COLUMN IF NOT EXISTS model_unions text[],
  ADD COLUMN IF NOT EXISTS mother_agency text,
  ADD COLUMN IF NOT EXISTS mother_agency_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agency_representation jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS model_categories text[],
  ADD COLUMN IF NOT EXISTS polaroids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS comp_card_layout jsonb;

COMMENT ON COLUMN public.profiles.model_stats IS 'Model measurements (metric): {height_cm,bust_cm,waist_cm,hips_cm,inseam_cm,shoe_eu,dress_eu,hair,eyes,skin_tone}';
COMMENT ON COLUMN public.profiles.agency_representation IS 'Array of {agency,city,contact,exclusive}';
COMMENT ON COLUMN public.profiles.polaroids IS 'Array of {url,taken_at,unretouched}';
COMMENT ON COLUMN public.profiles.comp_card_layout IS '{slots:[{role,portfolio_id}], order:[...]}';