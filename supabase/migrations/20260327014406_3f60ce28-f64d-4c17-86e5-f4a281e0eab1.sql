-- Event comments/discussion table
CREATE TABLE public.event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event comments" ON public.event_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create comments" ON public.event_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.event_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;

-- Co-hosts table
CREATE TABLE public.event_cohosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_cohosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view cohosts" ON public.event_cohosts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Event creator can add cohosts" ON public.event_cohosts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = added_by);

CREATE POLICY "Event creator can remove cohosts" ON public.event_cohosts
  FOR DELETE TO authenticated USING (auth.uid() = added_by);