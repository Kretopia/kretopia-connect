
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS barter_offering TEXT,
  ADD COLUMN IF NOT EXISTS barter_requesting TEXT,
  ADD COLUMN IF NOT EXISTS platform_requirements TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS min_followers INTEGER,
  ADD COLUMN IF NOT EXISTS content_deliverables JSONB DEFAULT '[]';

COMMENT ON COLUMN public.opportunities.barter_offering IS 'What the brand/venue offers in a barter deal (e.g. free meal, room night)';
COMMENT ON COLUMN public.opportunities.barter_requesting IS 'What content the brand expects in return (e.g. 1 reel + 3 stories)';
COMMENT ON COLUMN public.opportunities.platform_requirements IS 'Required social platforms (instagram, tiktok, youtube)';
COMMENT ON COLUMN public.opportunities.min_followers IS 'Minimum follower count required';
COMMENT ON COLUMN public.opportunities.content_deliverables IS 'Structured deliverables array [{type, quantity, platform}]';
