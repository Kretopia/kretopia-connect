-- Fix: every real (non-self) Co-Sign accept has been hard-failing.
--
-- submit_credit_endorsement_by_token() (and its predecessors, since
-- 2026-05-03) writes verification_status = 'peer' on a credit's first
-- accepted endorsement (a credit needs 2 accepted endorsements to become
-- fully 'verified' — 'peer' is the intentional, already-shipped
-- intermediate state; see src/lib/creativeRecord.ts, StatusProgressCard.tsx,
-- statusEngine.ts, ProductionPage.tsx, CreatorEPK.tsx, all of which already
-- read/render a 'peer' status).
--
-- But credits_verification_status_check (last touched 2026-04-18) never
-- allowed 'peer' as a value, so that UPDATE has always violated the check
-- constraint and rolled back the whole RPC call. Reproduced live
-- 2026-08-19 via a real guest confirm on a real credit — see
-- TRELLO_RELEASE_INVENTORY.md card 2.2 for the walkthrough. The decline
-- path is unaffected (it never touches credits.verification_status).
ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_verification_status_check;
ALTER TABLE public.credits ADD CONSTRAINT credits_verification_status_check
  CHECK (verification_status IS NULL OR verification_status IN (
    'unverified', 'verified', 'pending', 'pending_review', 'rejected', 'auto_discovered', 'disputed', 'peer'
  ));
