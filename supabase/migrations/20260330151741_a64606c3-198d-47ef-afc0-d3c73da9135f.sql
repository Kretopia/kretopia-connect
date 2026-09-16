
-- Magazine articles table
CREATE TABLE public.magazine_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'inspiration',
  tags TEXT[] DEFAULT '{}',
  author_name TEXT NOT NULL DEFAULT 'ThriveIN Magazine',
  author_avatar_url TEXT,
  author_user_id UUID,
  is_featured BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  read_time_minutes INT DEFAULT 3,
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magazine_articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "Anyone can read published articles"
  ON public.magazine_articles FOR SELECT
  USING (is_published = true);

-- Authenticated users can create articles (admin check in app)
CREATE POLICY "Authenticated users can create articles"
  ON public.magazine_articles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authors can update their own articles
CREATE POLICY "Authors can update own articles"
  ON public.magazine_articles FOR UPDATE
  TO authenticated
  USING (author_user_id = auth.uid());

-- Authors can delete their own articles
CREATE POLICY "Authors can delete own articles"
  ON public.magazine_articles FOR DELETE
  TO authenticated
  USING (author_user_id = auth.uid());

-- Podcast episodes table
CREATE TABLE public.podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  audio_url TEXT,
  embed_url TEXT,
  cover_image_url TEXT,
  duration_seconds INT,
  episode_number INT,
  season_number INT DEFAULT 1,
  guest_name TEXT,
  guest_role TEXT,
  is_published BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published episodes"
  ON public.podcast_episodes FOR SELECT
  USING (is_published = true);

CREATE POLICY "Authenticated users can manage episodes"
  ON public.podcast_episodes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
