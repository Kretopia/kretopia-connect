-- ============================================================
-- Manager commission transfer idempotency
--
-- PREPARED, NOT APPLIED. Written in response to ESCROW_IDEMPOTENCY_REPORT.md's
-- highest-severity finding: capture-milestone-payment/index.ts calls
-- stripe.transfers.create() to pay a talent manager's commission with no
-- idempotency key and no persisted record of which (milestone, manager)
-- commissions were already transferred. A retried capture request --
-- client retry, a duplicate invocation, an operator re-running the action
-- after a timeout -- creates a second real Stripe transfer, moving real
-- money a second time with nothing to catch it afterward.
--
-- Mirrors the exact pattern already sanctioned and applied in production
-- for the same class of problem: 20260818120000_thrivefund_milestone_release_idempotency.sql
-- (thrivefund_milestone_releases). Same shape: a dedicated ledger table
-- whose PRIMARY KEY *is* the deterministic operation key, INSERT a
-- 'reserved' row before ever calling Stripe, UPDATE to 'completed' with the
-- real transfer id on success, UPDATE to 'failed' on a genuine Stripe-side
-- error so a legitimate retry can proceed using the same key (and therefore
-- the same Stripe idempotency key, so Stripe's own 24h cache dedupes it if
-- the earlier attempt actually reached Stripe before failing to record).
--
-- The operation key is the composite (milestone_id, manager_id) primary
-- key itself -- not a random UUID, not a request-scoped nonce -- so two
-- concurrent or retried requests for the *same* commission collapse onto
-- the *same* row instead of creating two reservations.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.milestone_commission_transfers (
  milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  manager_id uuid NOT NULL REFERENCES public.talent_managers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'completed', 'failed', 'reversed')),
  commission_amount numeric(12,2) NOT NULL CHECK (commission_amount > 0),
  destination_account text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  stripe_transfer_id text,
  idempotency_key text NOT NULL,
  reserved_by uuid NOT NULL,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (milestone_id, manager_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_milestone_commission_transfers_stripe_id
  ON public.milestone_commission_transfers (stripe_transfer_id)
  WHERE stripe_transfer_id IS NOT NULL;

ALTER TABLE public.milestone_commission_transfers ENABLE ROW LEVEL SECURITY;

-- Read-only for the manager being paid and the project owner/client. All
-- writes happen via the service-role client inside capture-milestone-payment
-- and stripe-marketplace-webhook (transfer.reversed reconciliation), never
-- directly from a client -- same convention as thrivefund_milestone_releases
-- and every other payment-state table in this codebase.
--
-- Explicit REVOKE below (not just "no GRANT") because this session's own
-- investigation (PRIVILEGE_DRIFT_INVESTIGATION.md, and the milestones
-- finding in 20260824100000_...sql) found that a newly created table can
-- silently inherit a table-level GRANT from a Supabase project-level
-- default, outside any tracked migration. Explicit REVOKE + narrow GRANT
-- SELECT removes any ambiguity for this table from day one instead of
-- discovering the same gap again later via a live negative test.
REVOKE ALL ON public.milestone_commission_transfers FROM authenticated, anon;
GRANT SELECT ON public.milestone_commission_transfers TO authenticated;

CREATE POLICY "Manager or project owner can view own commission transfer"
  ON public.milestone_commission_transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.talent_managers tm
      WHERE tm.id = manager_id AND tm.manager_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.milestones m
      JOIN public.projects p ON p.id = m.project_id
      WHERE m.id = milestone_id
        AND (p.created_by = auth.uid() OR p.client_user_id = auth.uid())
    )
  );

-- Reconciliation query (for manual review after applying this migration --
-- not run automatically by any code):
--
--   SELECT milestone_id, manager_id, status, commission_amount,
--          destination_account, stripe_transfer_id, created_at, last_error
--   FROM public.milestone_commission_transfers
--   WHERE status = 'reserved' AND created_at < now() - interval '10 minutes'
--   ORDER BY created_at;
--
-- Any row matching that query is a reservation whose Stripe call outcome is
-- unknown (the edge function crashed, timed out, or the process was killed
-- between the INSERT and the UPDATE) -- it needs a human to check the
-- Stripe dashboard for a transfer with that idempotency key
-- (`milestone_commission_transfer:<milestone_id>:<manager_id>`) before
-- deciding whether to retry or mark it failed by hand.
