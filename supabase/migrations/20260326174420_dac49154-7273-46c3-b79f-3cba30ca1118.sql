
-- Credit endorsement system
CREATE TABLE public.credit_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  endorser_id UUID,
  endorser_email TEXT,
  endorser_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  testimonial TEXT,
  relationship TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  UNIQUE(credit_id, endorser_id),
  UNIQUE(credit_id, endorser_email)
);

-- AI verification results
CREATE TABLE public.credit_ai_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE UNIQUE,
  confidence_score NUMERIC(3,2) DEFAULT 0,
  evidence_links JSONB DEFAULT '[]'::jsonb,
  search_query TEXT,
  ai_summary TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'unverifiable', 'suspicious'))
);

-- Add endorsement_count to credits
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS endorsement_count INTEGER DEFAULT 0;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2) DEFAULT NULL;
ALTER TABLE public.credits ADD COLUMN IF NOT EXISTS credit_category TEXT DEFAULT 'general';

-- RLS for endorsements
ALTER TABLE public.credit_endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ai_verifications ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view endorsements on credits they can see
CREATE POLICY "Anyone can view endorsements" ON public.credit_endorsements
  FOR SELECT TO authenticated USING (true);

-- Credit owners can create endorsement requests
CREATE POLICY "Credit owners can request endorsements" ON public.credit_endorsements
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());

-- Endorsers can update their own endorsement
CREATE POLICY "Endorsers can respond" ON public.credit_endorsements
  FOR UPDATE TO authenticated USING (endorser_id = auth.uid());

-- Credit owners can delete their endorsement requests
CREATE POLICY "Credit owners can delete requests" ON public.credit_endorsements
  FOR DELETE TO authenticated USING (requested_by = auth.uid());

-- AI verifications readable by all
CREATE POLICY "Anyone can view ai verifications" ON public.credit_ai_verifications
  FOR SELECT TO authenticated USING (true);
