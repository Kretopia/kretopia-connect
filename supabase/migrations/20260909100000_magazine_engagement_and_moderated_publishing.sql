-- Magazine overhaul: likes + comments (mirrors the crew_feed_posts
-- reactions/comments pattern) and a moderated publish path so any
-- authenticated user can submit a story, not just admin/writer.

-- 1) Denormalized engagement counters on the article itself -----------------
ALTER TABLE public.magazine_articles
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0;

-- 2) Tighten the insert policy — it previously allowed WITH CHECK (true),
--    letting any authenticated user set author_user_id to someone else's
--    id. Only relevant now that submission is opening up beyond
--    admin/writer, since those were the only callers before.
DROP POLICY IF EXISTS "Authenticated users can create articles" ON public.magazine_articles;
CREATE POLICY "Authenticated users can create their own article"
  ON public.magazine_articles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_user_id);

-- 3) Moderated publishing — a submission from anyone who isn't admin/writer
--    is forced to is_published = false regardless of what the client sends,
--    so the "publish" CTA can be offered to every user without opening an
--    unmoderated firehose into the public Magazine feed.
CREATE OR REPLACE FUNCTION public.enforce_magazine_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'writer')) THEN
    NEW.is_published := false;
    NEW.is_featured := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_magazine_moderation ON public.magazine_articles;
CREATE TRIGGER trg_enforce_magazine_moderation
  BEFORE INSERT ON public.magazine_articles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_magazine_moderation();

-- A submitter should be able to see their own pending (unpublished) draft
-- even though "Anyone can read published articles" won't cover it.
CREATE POLICY "Authors read their own drafts"
  ON public.magazine_articles FOR SELECT
  TO authenticated
  USING (author_user_id = auth.uid());

-- 4) Likes -------------------------------------------------------------------
CREATE TABLE public.magazine_article_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.magazine_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, user_id)
);
CREATE INDEX idx_magazine_likes_article ON public.magazine_article_likes (article_id);

GRANT SELECT, INSERT, DELETE ON public.magazine_article_likes TO authenticated, anon;
GRANT ALL ON public.magazine_article_likes TO service_role;
ALTER TABLE public.magazine_article_likes ENABLE ROW LEVEL SECURITY;

-- Counts are shown publicly on published articles; a like row itself isn't
-- sensitive, so read access mirrors "Anyone can read published articles".
CREATE POLICY "Anyone can read likes on published articles"
  ON public.magazine_article_likes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.magazine_articles a WHERE a.id = article_id AND a.is_published = true)
  );
CREATE POLICY "Users like published articles"
  ON public.magazine_article_likes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.magazine_articles a WHERE a.id = article_id AND a.is_published = true)
  );
CREATE POLICY "Users remove their own like"
  ON public.magazine_article_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5) Comments ------------------------------------------------------------
CREATE TABLE public.magazine_article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.magazine_articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_magazine_comments_article ON public.magazine_article_comments (article_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.magazine_article_comments TO authenticated;
GRANT SELECT ON public.magazine_article_comments TO anon;
GRANT ALL ON public.magazine_article_comments TO service_role;
ALTER TABLE public.magazine_article_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments on published articles"
  ON public.magazine_article_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.magazine_articles a WHERE a.id = article_id AND a.is_published = true)
  );
CREATE POLICY "Users comment on published articles"
  ON public.magazine_article_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.magazine_articles a WHERE a.id = article_id AND a.is_published = true)
  );
CREATE POLICY "Author edits own comment"
  ON public.magazine_article_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Author or admin removes comment"
  ON public.magazine_article_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 6) Keep magazine_articles.like_count/comment_count in sync ----------------
CREATE OR REPLACE FUNCTION public.bump_magazine_article_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'magazine_article_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.magazine_articles SET like_count = like_count + 1 WHERE id = NEW.article_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.magazine_articles SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.article_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'magazine_article_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.magazine_articles SET comment_count = comment_count + 1 WHERE id = NEW.article_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.magazine_articles SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.article_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_magazine_likes_count
  AFTER INSERT OR DELETE ON public.magazine_article_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_magazine_article_counts();
CREATE TRIGGER trg_magazine_comments_count
  AFTER INSERT OR DELETE ON public.magazine_article_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_magazine_article_counts();
