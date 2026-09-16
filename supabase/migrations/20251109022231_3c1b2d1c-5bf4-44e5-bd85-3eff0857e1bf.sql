-- Create digital_products table for marketplace feature
CREATE TABLE IF NOT EXISTS public.digital_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  product_type TEXT NOT NULL, -- 'template', 'asset', 'course', 'ebook', 'music', 'video', 'other'
  category TEXT, -- 'design', 'music', 'video', 'writing', 'development', 'other'
  file_urls TEXT[], -- Array of file URLs
  preview_urls TEXT[], -- Preview images/videos
  demo_url TEXT, -- Demo or sample URL
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[],
  license_type TEXT DEFAULT 'standard', -- 'personal', 'commercial', 'standard', 'extended'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_products ENABLE ROW LEVEL SECURITY;

-- Policies for digital_products
CREATE POLICY "Anyone can view active products"
  ON public.digital_products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can create their own products"
  ON public.digital_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own products"
  ON public.digital_products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own products"
  ON public.digital_products FOR DELETE
  USING (auth.uid() = user_id);

-- Create digital_product_purchases table
CREATE TABLE IF NOT EXISTS public.digital_product_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  payment_intent_id TEXT,
  download_urls TEXT[],
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_product_purchases ENABLE ROW LEVEL SECURITY;

-- Policies for purchases
CREATE POLICY "Users can view their purchases"
  ON public.digital_product_purchases FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create purchases"
  ON public.digital_product_purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

-- Create digital_product_reviews table
CREATE TABLE IF NOT EXISTS public.digital_product_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.digital_products(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digital_product_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for reviews
CREATE POLICY "Anyone can view reviews"
  ON public.digital_product_reviews FOR SELECT
  USING (true);

CREATE POLICY "Buyers can create reviews"
  ON public.digital_product_reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update their own reviews"
  ON public.digital_product_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- Indexes for performance
CREATE INDEX idx_digital_products_user_id ON public.digital_products(user_id);
CREATE INDEX idx_digital_products_category ON public.digital_products(category);
CREATE INDEX idx_digital_products_type ON public.digital_products(product_type);
CREATE INDEX idx_digital_product_purchases_buyer ON public.digital_product_purchases(buyer_id);
CREATE INDEX idx_digital_product_purchases_seller ON public.digital_product_purchases(seller_id);
CREATE INDEX idx_digital_product_reviews_product ON public.digital_product_reviews(product_id);

-- Trigger for updated_at
CREATE TRIGGER update_digital_products_updated_at
  BEFORE UPDATE ON public.digital_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();