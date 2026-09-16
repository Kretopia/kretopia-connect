
-- Add price_max for range pricing
ALTER TABLE public.service_tiers ADD COLUMN IF NOT EXISTS price_max numeric DEFAULT NULL;

-- Ensure cover_image_url exists on creator_services (it should already)
ALTER TABLE public.creator_services ADD COLUMN IF NOT EXISTS cover_image_url text DEFAULT NULL;
