
-- Extend digital_products to support physical items and services
ALTER TABLE public.digital_products 
  ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS condition text,
  ADD COLUMN IF NOT EXISTS shipping_method text,
  ADD COLUMN IF NOT EXISTS shipping_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_location text,
  ADD COLUMN IF NOT EXISTS item_location text,
  ADD COLUMN IF NOT EXISTS service_format text,
  ADD COLUMN IF NOT EXISTS service_duration text,
  ADD COLUMN IF NOT EXISTS availability_info text,
  ADD COLUMN IF NOT EXISTS is_virtual boolean DEFAULT true;

-- Add index for listing type filtering
CREATE INDEX IF NOT EXISTS idx_digital_products_listing_type ON public.digital_products(listing_type);

-- Add check for valid listing types
ALTER TABLE public.digital_products 
  DROP CONSTRAINT IF EXISTS valid_listing_type;
ALTER TABLE public.digital_products 
  ADD CONSTRAINT valid_listing_type CHECK (listing_type IN ('digital', 'physical', 'service'));
