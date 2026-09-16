-- Enable realtime for activity feed tables
-- This allows the Circle feed to update instantly when new content is posted

-- Portfolio items
ALTER TABLE public.portfolio_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_items;

-- Awards
ALTER TABLE public.awards REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.awards;

-- Press links
ALTER TABLE public.press_links REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.press_links;

-- Feed posts
ALTER TABLE public.feed_posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;

-- Credits (for credit activity)
ALTER TABLE public.credits REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credits;