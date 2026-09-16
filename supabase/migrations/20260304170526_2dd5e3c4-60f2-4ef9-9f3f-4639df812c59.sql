-- Phase 3: Video intro, service packages, and availability

-- Add video intro field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_intro_url TEXT;

-- Add availability fields to profiles  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_note TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS available_from DATE;

-- Create service packages table
CREATE TABLE public.service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'basic',
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  delivery_days INTEGER,
  revisions INTEGER DEFAULT 1,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;

-- Public read for service packages
CREATE POLICY "Anyone can view active service packages"
ON public.service_packages FOR SELECT
USING (is_active = true);

-- Owners can manage their packages
CREATE POLICY "Users can manage own service packages"
ON public.service_packages FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());