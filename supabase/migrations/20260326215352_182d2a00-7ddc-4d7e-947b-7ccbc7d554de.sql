
-- Talent shortlist table for company AI suggestions
CREATE TABLE public.talent_shortlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_user_id UUID NOT NULL,
  talent_user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  match_score INTEGER DEFAULT 0,
  match_reasons JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'suggested',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_user_id, talent_user_id, opportunity_id)
);

ALTER TABLE public.talent_shortlist ENABLE ROW LEVEL SECURITY;

-- Companies can see their own shortlists
CREATE POLICY "Users can view own shortlists"
  ON public.talent_shortlist FOR SELECT
  TO authenticated
  USING (company_user_id = auth.uid());

-- Companies can insert to their own shortlists
CREATE POLICY "Users can insert own shortlists"
  ON public.talent_shortlist FOR INSERT
  TO authenticated
  WITH CHECK (company_user_id = auth.uid());

-- Companies can update their own shortlists
CREATE POLICY "Users can update own shortlists"
  ON public.talent_shortlist FOR UPDATE
  TO authenticated
  USING (company_user_id = auth.uid());

-- Companies can delete from their own shortlists
CREATE POLICY "Users can delete own shortlists"
  ON public.talent_shortlist FOR DELETE
  TO authenticated
  USING (company_user_id = auth.uid());
