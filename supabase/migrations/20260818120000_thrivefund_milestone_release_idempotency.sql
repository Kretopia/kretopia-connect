-- Fix for STRIPE_SECURITY_AUDIT.md finding: "thrivefund-release-milestone —
-- no idempotency guard on real Stripe transfers" (2026-08-18 audit).
--
-- APPLIED TO PRODUCTION 2026-08-18, reviewed and run by the user via the
-- Lovable Cloud SQL editor, independently verified by a read-only query
-- (information_schema.tables confirmed thrivefund_milestone_releases
-- exists) -- see SECURITY_RELEASE_GATE.md §F. The "not yet applied" language
-- below is preserved as written at authoring time for the record of what
-- was reviewed before being run; it no longer describes the current state.
--
-- supabase/functions/thrivefund-release-milestone/index.ts calls
-- stripe.transfers.create() to send a real payout tranche to a campaign
-- creator's Connect account. It had zero persisted record of which
-- (campaign, milestone) tranches were already released — a retried,
-- replayed, or repeated call moved additional real money every time.
--
-- A same-session code fix already adds a deterministic Stripe idempotency
-- key (`thrivefund_milestone_${campaignId}_${milestoneIndex}`), which closes
-- the common case (double-click, network-retry, webhook-style replay) via
-- Stripe's own 24-hour idempotency cache. This table is the permanent,
-- unlimited-window guard: the edge function INSERTs a 'pending' row here
-- (which fails on a duplicate (campaign_id, milestone_index) pair) *before*
-- ever calling Stripe, then updates it to 'completed' with the real
-- transfer_id on success, or deletes it on a genuine Stripe-side failure so a
-- legitimate retry can proceed. The edge-function side of this (commit
-- 25fa0425) is wired in and deployed alongside this table -- confirmed by
-- direct grep of supabase/functions/thrivefund-release-milestone/index.ts,
-- which reads/writes public.thrivefund_milestone_releases at 3 call sites.
-- Its live-deployment status on the Edge Functions runtime (as opposed to
-- being present in this repo) has not been independently re-verified this
-- pass -- see SECURITY_DATA_INTEGRITY_RECHECK.md and TRELLO_RELEASE_INVENTORY.md
-- card 5.1 for what's still open.

CREATE TABLE IF NOT EXISTS public.thrivefund_milestone_releases (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  milestone_index integer NOT NULL CHECK (milestone_index >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  amount_cents integer,
  currency text,
  stripe_transfer_id text,
  released_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (campaign_id, milestone_index)
);

ALTER TABLE public.thrivefund_milestone_releases ENABLE ROW LEVEL SECURITY;

-- Read-only for the campaign creator (matches the release action's own
-- authorization check in the edge function: campaign.creator_id = caller).
-- All writes happen via the service-role client inside the edge function,
-- never directly from the client, same as every other payment-state table
-- in this codebase.
CREATE POLICY "Creator can view own campaign's milestone releases"
  ON public.thrivefund_milestone_releases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND c.creator_id = auth.uid()
    )
  );
