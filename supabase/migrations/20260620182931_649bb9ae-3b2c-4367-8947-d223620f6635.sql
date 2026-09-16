-- Crew Feed (Phase 2): posts + reactions + comments

CREATE TABLE public.crew_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES public.spark_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 5000),
  media_url TEXT,
  media_type TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  reaction_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crew_feed_posts_circle ON public.crew_feed_posts (circle_id, is_pinned DESC, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_feed_posts TO authenticated;
GRANT ALL ON public.crew_feed_posts TO service_role;

ALTER TABLE public.crew_feed_posts ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper — used by feed policies; avoids recursion through spark_room_members RLS.
CREATE OR REPLACE FUNCTION public.is_crew_member(_circle_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spark_room_members
    WHERE room_id = _circle_id AND user_id = _user_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_crew_member(UUID, UUID) TO authenticated, service_role;

CREATE POLICY "Crew members read feed" ON public.crew_feed_posts
  FOR SELECT TO authenticated USING (public.is_crew_member(circle_id, auth.uid()));
CREATE POLICY "Crew members post to feed" ON public.crew_feed_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_crew_member(circle_id, auth.uid()));
CREATE POLICY "Author or admin updates post" ON public.crew_feed_posts
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.spark_room_members m
      WHERE m.room_id = circle_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );
CREATE POLICY "Author or admin deletes post" ON public.crew_feed_posts
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.spark_room_members m
      WHERE m.room_id = circle_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Reactions
CREATE TABLE public.crew_feed_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.crew_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '👍',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, emoji)
);
CREATE INDEX idx_crew_feed_reactions_post ON public.crew_feed_post_reactions (post_id);

GRANT SELECT, INSERT, DELETE ON public.crew_feed_post_reactions TO authenticated;
GRANT ALL ON public.crew_feed_post_reactions TO service_role;
ALTER TABLE public.crew_feed_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members read reactions" ON public.crew_feed_post_reactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_feed_posts p WHERE p.id = post_id AND public.is_crew_member(p.circle_id, auth.uid()))
  );
CREATE POLICY "Crew members react" ON public.crew_feed_post_reactions
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.crew_feed_posts p WHERE p.id = post_id AND public.is_crew_member(p.circle_id, auth.uid()))
  );
CREATE POLICY "Users remove their own reaction" ON public.crew_feed_post_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Comments
CREATE TABLE public.crew_feed_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.crew_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_crew_feed_comments_post ON public.crew_feed_post_comments (post_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_feed_post_comments TO authenticated;
GRANT ALL ON public.crew_feed_post_comments TO service_role;
ALTER TABLE public.crew_feed_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew members read comments" ON public.crew_feed_post_comments
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.crew_feed_posts p WHERE p.id = post_id AND public.is_crew_member(p.circle_id, auth.uid()))
  );
CREATE POLICY "Crew members comment" ON public.crew_feed_post_comments
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.crew_feed_posts p WHERE p.id = post_id AND public.is_crew_member(p.circle_id, auth.uid()))
  );
CREATE POLICY "Author edits own comment" ON public.crew_feed_post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Author or admin removes comment" ON public.crew_feed_post_comments
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.crew_feed_posts p
      JOIN public.spark_room_members m ON m.room_id = p.circle_id
      WHERE p.id = post_id AND m.user_id = auth.uid() AND m.role = 'admin'
    )
  );

-- Counter sync triggers
CREATE OR REPLACE FUNCTION public.bump_crew_feed_counts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'crew_feed_post_reactions' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.crew_feed_posts SET reaction_count = reaction_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.crew_feed_posts SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'crew_feed_post_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.crew_feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.crew_feed_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_crew_feed_reactions_count
  AFTER INSERT OR DELETE ON public.crew_feed_post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.bump_crew_feed_counts();
CREATE TRIGGER trg_crew_feed_comments_count
  AFTER INSERT OR DELETE ON public.crew_feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_crew_feed_counts();

CREATE TRIGGER trg_crew_feed_posts_updated_at
  BEFORE UPDATE ON public.crew_feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crew_feed_comments_updated_at
  BEFORE UPDATE ON public.crew_feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_feed_post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_feed_post_comments;