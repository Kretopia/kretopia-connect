
-- Add view_count column to opportunities table
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_opportunities_created_by_view_count 
  ON public.opportunities (created_by, view_count DESC);

-- Create opportunity_views table for detailed tracking
CREATE TABLE IF NOT EXISTS public.opportunity_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  viewer_id UUID,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  referrer TEXT
);

-- Enable RLS
ALTER TABLE public.opportunity_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a view (including anonymous)
CREATE POLICY "Anyone can record a view"
  ON public.opportunity_views
  FOR INSERT
  WITH CHECK (true);

-- Opportunity owners can read views on their opportunities
CREATE POLICY "Owners can read views"
  ON public.opportunity_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = opportunity_id
      AND o.created_by = auth.uid()
    )
  );

-- Create index for time-series queries
CREATE INDEX idx_opportunity_views_opp_date 
  ON public.opportunity_views (opportunity_id, viewed_at DESC);

-- Function to increment view count
CREATE OR REPLACE FUNCTION public.increment_opportunity_view_count()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE opportunities 
  SET view_count = view_count + 1
  WHERE id = NEW.opportunity_id;
  RETURN NEW;
END;
$$;

-- Trigger to auto-increment view_count
CREATE TRIGGER on_opportunity_view_insert
  AFTER INSERT ON public.opportunity_views
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_opportunity_view_count();
