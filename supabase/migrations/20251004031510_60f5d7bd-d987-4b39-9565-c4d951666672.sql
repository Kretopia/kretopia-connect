-- Create feed_posts table for the Spark social feed
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb, -- Array of {url, type: 'image'|'video'|'audio', thumbnail}
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'mixed', 'text')),
  tags TEXT[] DEFAULT '{}',
  is_portfolio_item BOOLEAN DEFAULT false,
  portfolio_item_id UUID REFERENCES portfolio_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create feed_reactions table for 🔥 reactions
CREATE TABLE IF NOT EXISTS public.feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Create feed_comments table
CREATE TABLE IF NOT EXISTS public.feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_posts
CREATE POLICY "Users can view posts from connections" ON public.feed_posts
  FOR SELECT USING (
    user_id = auth.uid() OR
    user_id IN (
      SELECT connected_user_id FROM connections WHERE user_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT user_id FROM connections WHERE connected_user_id = auth.uid() AND status = 'accepted'
      UNION
      SELECT CASE WHEN user1_id = auth.uid() THEN user2_id ELSE user1_id END
      FROM matches WHERE (user1_id = auth.uid() OR user2_id = auth.uid()) AND status = 'active'
    )
  );

CREATE POLICY "Users can create their own posts" ON public.feed_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.feed_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.feed_posts
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for feed_reactions
CREATE POLICY "Users can view all reactions" ON public.feed_reactions
  FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON public.feed_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions" ON public.feed_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for feed_comments
CREATE POLICY "Users can view comments on visible posts" ON public.feed_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM feed_posts
      WHERE feed_posts.id = feed_comments.post_id
      AND (
        feed_posts.user_id = auth.uid() OR
        feed_posts.user_id IN (
          SELECT connected_user_id FROM connections WHERE user_id = auth.uid() AND status = 'accepted'
          UNION
          SELECT user_id FROM connections WHERE connected_user_id = auth.uid() AND status = 'accepted'
        )
      )
    )
  );

CREATE POLICY "Users can create comments" ON public.feed_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.feed_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.feed_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_feed_posts_user_id ON public.feed_posts(user_id);
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts(created_at DESC);
CREATE INDEX idx_feed_reactions_post_id ON public.feed_reactions(post_id);
CREATE INDEX idx_feed_comments_post_id ON public.feed_comments(post_id);

-- Create trigger for updated_at
CREATE TRIGGER update_feed_posts_updated_at
  BEFORE UPDATE ON public.feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feed_comments_updated_at
  BEFORE UPDATE ON public.feed_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();