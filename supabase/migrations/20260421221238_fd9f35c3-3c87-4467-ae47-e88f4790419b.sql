-- 1. Unique partial index: same source URL + same role can only be claimed once
-- (allows multiple roles on the same project, e.g., Director + Editor on same film)
CREATE UNIQUE INDEX IF NOT EXISTS credits_unique_source_role
  ON public.credits (LOWER(url), LOWER(role))
  WHERE url IS NOT NULL AND verification_status IN ('verified', 'pending');

-- 2. Disputes table
CREATE TABLE IF NOT EXISTS public.credit_claim_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_id UUID NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  current_owner_id UUID NOT NULL,
  challenger_id UUID NOT NULL,
  challenger_role TEXT,
  challenger_evidence TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn')),
  resolution_note TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_credit ON public.credit_claim_disputes(credit_id);
CREATE INDEX IF NOT EXISTS idx_disputes_owner ON public.credit_claim_disputes(current_owner_id);
CREATE INDEX IF NOT EXISTS idx_disputes_challenger ON public.credit_claim_disputes(challenger_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.credit_claim_disputes(status);

ALTER TABLE public.credit_claim_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Challengers create disputes"
  ON public.credit_claim_disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id AND auth.uid() <> current_owner_id);

CREATE POLICY "Parties view their disputes"
  ON public.credit_claim_disputes FOR SELECT
  TO authenticated
  USING (
    auth.uid() = challenger_id
    OR auth.uid() = current_owner_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owner or admin resolves dispute"
  ON public.credit_claim_disputes FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = current_owner_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = challenger_id AND status = 'pending')
  );

CREATE TRIGGER update_credit_disputes_updated_at
  BEFORE UPDATE ON public.credit_claim_disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();