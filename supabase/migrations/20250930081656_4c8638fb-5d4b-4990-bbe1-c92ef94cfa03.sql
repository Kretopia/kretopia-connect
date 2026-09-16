-- Create storage bucket for portfolio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio',
  'portfolio',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf', 'audio/mpeg', 'audio/wav']
);

-- Storage policies for portfolio bucket
CREATE POLICY "Public can view portfolio files"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio');

CREATE POLICY "Users can upload own portfolio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'portfolio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own portfolio files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'portfolio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own portfolio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'portfolio' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Portfolio items table
CREATE TABLE public.portfolio_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'document', 'embed')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  embed_code TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  featured BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio items are viewable by everyone"
ON public.portfolio_items FOR SELECT
USING (true);

CREATE POLICY "Users can insert own portfolio items"
ON public.portfolio_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolio items"
ON public.portfolio_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolio items"
ON public.portfolio_items FOR DELETE
USING (auth.uid() = user_id);

-- Reviews and endorsements table
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_role TEXT,
  reviewer_company TEXT,
  reviewer_avatar_url TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  project_name TEXT,
  collaboration_type TEXT,
  is_endorsed BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
ON public.reviews FOR SELECT
USING (status = 'approved');

CREATE POLICY "Users can view all reviews for their profile"
ON public.reviews FOR SELECT
USING (auth.uid() = profile_id);

CREATE POLICY "Users can create reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Profile owners can update review status"
ON public.reviews FOR UPDATE
USING (auth.uid() = profile_id);

-- Industry stats table
CREATE TABLE public.industry_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  stat_type TEXT NOT NULL CHECK (stat_type IN ('achievement', 'certification', 'award', 'metric', 'experience')),
  title TEXT NOT NULL,
  value TEXT,
  description TEXT,
  icon TEXT,
  date_achieved DATE,
  issuer TEXT,
  verification_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.industry_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Industry stats are viewable by everyone"
ON public.industry_stats FOR SELECT
USING (true);

CREATE POLICY "Users can insert own industry stats"
ON public.industry_stats FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own industry stats"
ON public.industry_stats FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own industry stats"
ON public.industry_stats FOR DELETE
USING (auth.uid() = user_id);

-- Add social links to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS behance_url TEXT,
ADD COLUMN IF NOT EXISTS imdb_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS spotify_url TEXT,
ADD COLUMN IF NOT EXISTS soundcloud_url TEXT;

-- Triggers for updated_at
CREATE TRIGGER update_portfolio_items_updated_at
BEFORE UPDATE ON public.portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_industry_stats_updated_at
BEFORE UPDATE ON public.industry_stats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_portfolio_items_user_id ON public.portfolio_items(user_id);
CREATE INDEX idx_portfolio_items_featured ON public.portfolio_items(featured) WHERE featured = true;
CREATE INDEX idx_reviews_profile_id ON public.reviews(profile_id);
CREATE INDEX idx_reviews_status ON public.reviews(status);
CREATE INDEX idx_industry_stats_user_id ON public.industry_stats(user_id);
CREATE INDEX idx_industry_stats_featured ON public.industry_stats(is_featured) WHERE is_featured = true;