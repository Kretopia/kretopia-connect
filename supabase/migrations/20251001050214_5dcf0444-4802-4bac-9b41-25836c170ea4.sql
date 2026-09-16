-- Create saved_opportunities table for bookmarking
CREATE TABLE public.saved_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, opportunity_id)
);

-- Enable RLS
ALTER TABLE public.saved_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their saved opportunities"
  ON public.saved_opportunities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save opportunities"
  ON public.saved_opportunities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved opportunities"
  ON public.saved_opportunities
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their saved opportunities"
  ON public.saved_opportunities
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_saved_opportunities_user ON public.saved_opportunities(user_id);
CREATE INDEX idx_saved_opportunities_opportunity ON public.saved_opportunities(opportunity_id);

-- Add application_notes column to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS application_notes TEXT,
ADD COLUMN IF NOT EXISTS expected_rate TEXT,
ADD COLUMN IF NOT EXISTS availability TEXT;

-- Create view for application tracking
CREATE OR REPLACE VIEW public.user_applications_view AS
SELECT 
  a.*,
  o.title as opportunity_title,
  o.type as opportunity_type,
  o.compensation,
  o.location,
  o.created_by as poster_id,
  p.full_name as poster_name,
  p.avatar_url as poster_avatar
FROM public.applications a
JOIN public.opportunities o ON a.opportunity_id = o.id
LEFT JOIN public.profiles p ON o.created_by = p.user_id;

-- Grant access to the view
GRANT SELECT ON public.user_applications_view TO authenticated;