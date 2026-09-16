-- Create partner submissions table for pending partner discount applications
CREATE TABLE IF NOT EXISTS public.partner_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  website_url TEXT,
  logo_url TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'special_offer')),
  discount_value TEXT NOT NULL,
  description TEXT NOT NULL,
  terms TEXT,
  category TEXT NOT NULL CHECK (category IN ('coworking', 'software', 'equipment', 'services', 'wellness', 'education', 'other')),
  tier_required TEXT NOT NULL DEFAULT 'free' CHECK (tier_required IN ('free', 'creator_pro', 'thriver')),
  redemption_url TEXT,
  redemption_code TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.partner_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can submit (no auth required)
CREATE POLICY "Anyone can submit partner applications"
ON public.partner_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Policy: Submitters can view their own submissions
CREATE POLICY "Users can view their own submissions"
ON public.partner_submissions
FOR SELECT
TO authenticated
USING (contact_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Policy: Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
ON public.partner_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Policy: Admins can update submissions (approve/reject)
CREATE POLICY "Admins can update submissions"
ON public.partner_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-logos',
  'partner-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for partner logos
CREATE POLICY "Anyone can upload partner logos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'partner-logos');

CREATE POLICY "Partner logos are publicly viewable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'partner-logos');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_partner_submissions_status ON public.partner_submissions(status);
CREATE INDEX IF NOT EXISTS idx_partner_submissions_email ON public.partner_submissions(contact_email);

COMMENT ON TABLE public.partner_submissions IS 'Pending partner discount applications submitted via public form';