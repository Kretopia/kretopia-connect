-- Audit table for AI gig moderation actions
CREATE TABLE IF NOT EXISTS public.gig_moderation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('closed_expired','closed_stale','flagged_spam','flagged_duplicate','skipped','reopened')),
  reason TEXT NOT NULL,
  confidence NUMERIC(3,2),
  detected_deadline DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gig_mod_log_opp ON public.gig_moderation_log(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_gig_mod_log_created ON public.gig_moderation_log(created_at DESC);

ALTER TABLE public.gig_moderation_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all moderation logs
CREATE POLICY "Admins can read moderation log"
  ON public.gig_moderation_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Gig owners can read their own moderation entries
CREATE POLICY "Owners can read their own moderation entries"
  ON public.gig_moderation_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.opportunities o
      WHERE o.id = gig_moderation_log.opportunity_id
        AND o.created_by = auth.uid()
    )
  );

-- No client inserts/updates; service role bypasses RLS for the edge function.