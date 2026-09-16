-- Connected platforms for OAuth-based auto-verification
CREATE TABLE public.connected_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'spotify', 'youtube', 'instagram', 'imdb', 'discogs'
  platform_user_id TEXT,
  platform_username TEXT,
  access_token TEXT, -- encrypted in practice
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  platform_data JSONB DEFAULT '{}'::jsonb, -- cached metrics (followers, streams, etc.)
  last_synced_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Verified credits from external sources (IMDB, Discogs, Spotify, etc.)
CREATE TABLE public.verified_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'imdb', 'discogs', 'spotify', 'youtube', 'allmusic'
  source_id TEXT, -- external ID from the source
  credit_type TEXT NOT NULL, -- 'film', 'tv', 'album', 'single', 'music_video', 'documentary'
  title TEXT NOT NULL,
  role TEXT, -- 'Director', 'Producer', 'Artist', 'Songwriter', etc.
  year INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb, -- additional info (streams, views, ratings, etc.)
  verification_url TEXT,
  verified_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, source, source_id)
);

-- Enable RLS
ALTER TABLE public.connected_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connected_platforms (private - only owner can see tokens)
CREATE POLICY "Users can view own connected platforms"
  ON public.connected_platforms FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected platforms"
  ON public.connected_platforms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected platforms"
  ON public.connected_platforms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connected platforms"
  ON public.connected_platforms FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for verified_credits (public readable for credibility)
CREATE POLICY "Anyone can view verified credits"
  ON public.verified_credits FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own verified credits"
  ON public.verified_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verified credits"
  ON public.verified_credits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own verified credits"
  ON public.verified_credits FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_connected_platforms_user ON public.connected_platforms(user_id);
CREATE INDEX idx_connected_platforms_platform ON public.connected_platforms(platform);
CREATE INDEX idx_verified_credits_user ON public.verified_credits(user_id);
CREATE INDEX idx_verified_credits_source ON public.verified_credits(source);

-- Update profiles with platform verification fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS spotify_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS youtube_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS instagram_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS imdb_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS discogs_verified BOOLEAN DEFAULT false;