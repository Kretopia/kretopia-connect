-- Create communities table
CREATE TABLE public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cover_url TEXT,
  created_by UUID NOT NULL,
  member_count INTEGER DEFAULT 0,
  is_official BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,
  category TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_members table
CREATE TABLE public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, user_id)
);

-- Create community_posts table
CREATE TABLE public.community_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  media_urls TEXT[],
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create community_post_reactions table
CREATE TABLE public.community_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_post_reactions ENABLE ROW LEVEL SECURITY;

-- Communities policies
CREATE POLICY "Anyone can view public communities"
  ON public.communities FOR SELECT
  USING (is_private = false OR id IN (
    SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create communities"
  ON public.communities FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update communities"
  ON public.communities FOR UPDATE
  USING (id IN (
    SELECT community_id FROM public.community_members 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- Community members policies
CREATE POLICY "Members can view community members"
  ON public.community_members FOR SELECT
  USING (community_id IN (
    SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
  ) OR community_id IN (
    SELECT id FROM public.communities WHERE is_private = false
  ));

CREATE POLICY "Users can join communities"
  ON public.community_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
  ON public.community_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage members"
  ON public.community_members FOR ALL
  USING (community_id IN (
    SELECT community_id FROM public.community_members 
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  ));

-- Community posts policies
CREATE POLICY "Members can view community posts"
  ON public.community_posts FOR SELECT
  USING (community_id IN (
    SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
  ) OR community_id IN (
    SELECT id FROM public.communities WHERE is_private = false
  ));

CREATE POLICY "Members can create posts"
  ON public.community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    community_id IN (
      SELECT community_id FROM public.community_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own posts"
  ON public.community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON public.community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Community post reactions policies
CREATE POLICY "Anyone can view reactions"
  ON public.community_post_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.community_post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.community_post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities 
    SET member_count = member_count + 1 
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities 
    SET member_count = member_count - 1 
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for member count
CREATE TRIGGER update_community_member_count_trigger
AFTER INSERT OR DELETE ON public.community_members
FOR EACH ROW
EXECUTE FUNCTION update_community_member_count();