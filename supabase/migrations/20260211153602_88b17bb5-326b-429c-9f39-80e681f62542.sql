
-- Create storage bucket for product deliverable files (private - only accessible after purchase)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-files', 'product-files', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload product files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own uploaded files
CREATE POLICY "Users can view own product files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create marketplace_orders table for tracking all marketplace transactions
CREATE TABLE public.marketplace_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.digital_products(id),
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  listing_type TEXT NOT NULL DEFAULT 'digital',
  amount NUMERIC NOT NULL,
  platform_fee NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_intent_id TEXT,
  checkout_session_id TEXT,
  
  -- Delivery tracking
  delivery_status TEXT DEFAULT 'pending',
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  tracking_number TEXT,
  delivery_notes TEXT,
  
  -- Escrow
  escrow_released_at TIMESTAMPTZ,
  buyer_confirmed_at TIMESTAMPTZ,
  auto_release_at TIMESTAMPTZ,
  dispute_reason TEXT,
  
  -- File access (for digital)
  download_urls TEXT[],
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own orders
CREATE POLICY "Buyers can view own orders"
ON public.marketplace_orders FOR SELECT
TO authenticated
USING (auth.uid() = buyer_id);

-- Sellers can view orders for their listings
CREATE POLICY "Sellers can view their orders"
ON public.marketplace_orders FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);

-- Only system (edge functions via service role) inserts orders
-- Buyers can update delivery confirmation
CREATE POLICY "Buyers can confirm delivery"
ON public.marketplace_orders FOR UPDATE
TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);

-- Sellers can update shipping info
CREATE POLICY "Sellers can update shipping"
ON public.marketplace_orders FOR UPDATE
TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

-- Trigger for updated_at
CREATE TRIGGER update_marketplace_orders_updated_at
BEFORE UPDATE ON public.marketplace_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
