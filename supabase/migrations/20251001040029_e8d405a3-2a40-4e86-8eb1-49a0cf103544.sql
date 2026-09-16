-- Create credits table for project credits
CREATE TABLE public.credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  role TEXT NOT NULL,
  year INTEGER,
  platform TEXT,
  url TEXT,
  thumbnail_url TEXT,
  embed_data JSONB,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  verification_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create press_links table for media coverage
CREATE TABLE public.press_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  publication TEXT,
  published_date DATE,
  thumbnail_url TEXT,
  excerpt TEXT,
  og_data JSONB,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create awards table for recognition and achievements
CREATE TABLE public.awards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  year INTEGER,
  description TEXT,
  category TEXT,
  image_url TEXT,
  certificate_url TEXT,
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')),
  verification_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.press_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credits
CREATE POLICY "Users can view all credits"
  ON public.credits FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own credits"
  ON public.credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON public.credits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credits"
  ON public.credits FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for press_links
CREATE POLICY "Users can view all press links"
  ON public.press_links FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own press links"
  ON public.press_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own press links"
  ON public.press_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own press links"
  ON public.press_links FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for awards
CREATE POLICY "Users can view all awards"
  ON public.awards FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own awards"
  ON public.awards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own awards"
  ON public.awards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own awards"
  ON public.awards FOR DELETE
  USING (auth.uid() = user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_credits_updated_at
  BEFORE UPDATE ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_press_links_updated_at
  BEFORE UPDATE ON public.press_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_awards_updated_at
  BEFORE UPDATE ON public.awards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_credits_user_id ON public.credits(user_id);
CREATE INDEX idx_credits_verification ON public.credits(verification_status);
CREATE INDEX idx_press_links_user_id ON public.press_links(user_id);
CREATE INDEX idx_press_links_verification ON public.press_links(verification_status);
CREATE INDEX idx_awards_user_id ON public.awards(user_id);
CREATE INDEX idx_awards_verification ON public.awards(verification_status);