
CREATE TABLE public.site_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  visitor_id TEXT,
  page_path TEXT,
  referrer TEXT,
  event_type TEXT NOT NULL DEFAULT 'view',
  event_target TEXT,
  country TEXT,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site owners can view their analytics"
ON public.site_analytics FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert analytics"
ON public.site_analytics FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_site_analytics_user_id ON public.site_analytics(user_id);
CREATE INDEX idx_site_analytics_created_at ON public.site_analytics(created_at);
