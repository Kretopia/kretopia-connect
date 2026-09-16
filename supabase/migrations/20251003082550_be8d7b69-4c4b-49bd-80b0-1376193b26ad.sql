-- Create partner_discounts table for membership benefits
CREATE TABLE IF NOT EXISTS public.partner_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name TEXT NOT NULL,
  partner_logo_url TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'special_offer')),
  discount_value TEXT NOT NULL,
  description TEXT NOT NULL,
  terms TEXT,
  category TEXT NOT NULL CHECK (category IN ('coworking', 'software', 'equipment', 'services', 'wellness', 'education', 'other')),
  tier_required TEXT NOT NULL DEFAULT 'free' CHECK (tier_required IN ('free', 'creator_pro', 'thriver')),
  redemption_url TEXT,
  redemption_code TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_discounts ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view active discounts for their tier
CREATE POLICY "Users can view discounts for their tier"
ON public.partner_discounts
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    tier_required = 'free'
    OR (
      tier_required = 'creator_pro' 
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.subscription_tier IN ('creator_pro', 'thriver')
      )
    )
    OR (
      tier_required = 'thriver'
      AND EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = auth.uid() 
        AND profiles.subscription_tier = 'thriver'
      )
    )
  )
);

-- Policy: Only admins can manage discounts
CREATE POLICY "Admins can manage partner discounts"
ON public.partner_discounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_partner_discounts_tier ON public.partner_discounts(tier_required, is_active);
CREATE INDEX IF NOT EXISTS idx_partner_discounts_category ON public.partner_discounts(category);

-- Add trigger for updated_at
CREATE TRIGGER update_partner_discounts_updated_at
  BEFORE UPDATE ON public.partner_discounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample partner discounts
INSERT INTO public.partner_discounts (partner_name, partner_logo_url, discount_type, discount_value, description, category, tier_required, redemption_code) VALUES
('WeWork', 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200', 'percentage', '20%', 'Get 20% off any WeWork membership', 'coworking', 'creator_pro', 'THRIVE20'),
('Adobe Creative Cloud', 'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200', 'percentage', '25%', 'Save 25% on Creative Cloud All Apps', 'software', 'creator_pro', 'THRIVECC25'),
('Skillshare', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200', 'special_offer', '2 months free', 'Get 2 months of Skillshare Premium for free', 'education', 'free', 'THRIVE2MO'),
('Canva Pro', 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=200', 'percentage', '30%', 'Exclusive 30% discount on Canva Pro', 'software', 'thriver', 'THRIVECANVA'),
('FitBit Premium', 'https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=200', 'percentage', '15%', 'Stay healthy with 15% off FitBit Premium', 'wellness', 'creator_pro', 'THRIVEFIT15');

COMMENT ON TABLE public.partner_discounts IS 'Partner discounts available to members based on their subscription tier';