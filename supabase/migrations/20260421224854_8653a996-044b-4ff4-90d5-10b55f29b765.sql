-- Add auto-resolution deadline (7 days from creation) for owner non-response
ALTER TABLE public.credit_claim_disputes
  ADD COLUMN IF NOT EXISTS auto_resolve_at timestamptz;

-- Backfill existing rows + set default for new
UPDATE public.credit_claim_disputes
SET auto_resolve_at = created_at + INTERVAL '7 days'
WHERE auto_resolve_at IS NULL;

ALTER TABLE public.credit_claim_disputes
  ALTER COLUMN auto_resolve_at SET DEFAULT (now() + INTERVAL '7 days');

-- Admin policies for full visibility + arbitration
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.credit_claim_disputes;
CREATE POLICY "Admins can view all disputes"
  ON public.credit_claim_disputes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update any dispute" ON public.credit_claim_disputes;
CREATE POLICY "Admins can update any dispute"
  ON public.credit_claim_disputes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_disputes_auto_resolve
  ON public.credit_claim_disputes (auto_resolve_at)
  WHERE status = 'pending';