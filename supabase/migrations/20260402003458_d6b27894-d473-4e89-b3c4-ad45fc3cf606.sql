
-- 1. Location bookmarks table
CREATE TABLE public.location_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.creative_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id)
);

ALTER TABLE public.location_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can see their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON public.location_bookmarks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can create their own bookmarks
CREATE POLICY "Users can create own bookmarks"
  ON public.location_bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON public.location_bookmarks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2. Add claimed_by_user_id to creative_locations for brand page linking
ALTER TABLE public.creative_locations
  ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
