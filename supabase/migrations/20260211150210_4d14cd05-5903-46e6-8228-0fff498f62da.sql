
-- Extend feed_posts to be the unified feed table
ALTER TABLE public.feed_posts 
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS prompt_id uuid REFERENCES public.spark_prompts(id),
  ADD COLUMN IF NOT EXISTS auto_activity_message text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS link_title text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;

-- Add index for feed queries
CREATE INDEX IF NOT EXISTS idx_feed_posts_post_type ON public.feed_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_feed_posts_category ON public.feed_posts(category);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON public.feed_posts(created_at DESC);

-- Create a function to auto-create feed posts when credits/awards/portfolio/press are added
CREATE OR REPLACE FUNCTION public.auto_create_activity_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  activity_message text;
  post_category text;
  source text;
BEGIN
  IF TG_TABLE_NAME = 'credits' THEN
    activity_message := '🎬 Just wrapped ' || NEW.project_name || ' as ' || NEW.role || ' — show them some 🔥!';
    post_category := 'credit';
    source := 'credit';
  ELSIF TG_TABLE_NAME = 'awards' THEN
    activity_message := '🏆 Won ' || NEW.title || ' from ' || NEW.organization || ' — congratulations are in order!';
    post_category := 'award';
    source := 'award';
  ELSIF TG_TABLE_NAME = 'portfolio_items' THEN
    activity_message := '✨ Added new work: ' || NEW.title || ' — check it out!';
    post_category := COALESCE(NEW.media_type, 'general');
    source := 'portfolio';
  ELSIF TG_TABLE_NAME = 'press_links' THEN
    activity_message := '📰 Featured: ' || NEW.title || COALESCE(' in ' || NEW.publication, '') || ' — big news!';
    post_category := 'press';
    source := 'press';
  END IF;

  INSERT INTO feed_posts (user_id, content, post_type, category, auto_activity_message, source_type, source_id)
  VALUES (NEW.user_id, activity_message, 'activity', post_category, activity_message, source, NEW.id::text);
  
  RETURN NEW;
END;
$$;

-- Create triggers for auto-posting
DROP TRIGGER IF EXISTS auto_post_on_credit ON public.credits;
CREATE TRIGGER auto_post_on_credit
  AFTER INSERT ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_activity_post();

DROP TRIGGER IF EXISTS auto_post_on_award ON public.awards;
CREATE TRIGGER auto_post_on_award
  AFTER INSERT ON public.awards
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_activity_post();

DROP TRIGGER IF EXISTS auto_post_on_portfolio ON public.portfolio_items;
CREATE TRIGGER auto_post_on_portfolio
  AFTER INSERT ON public.portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_activity_post();

DROP TRIGGER IF EXISTS auto_post_on_press ON public.press_links;
CREATE TRIGGER auto_post_on_press
  AFTER INSERT ON public.press_links
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_activity_post();
