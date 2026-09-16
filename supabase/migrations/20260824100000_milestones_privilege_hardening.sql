-- ============================================================
-- Milestones privilege hardening
--
-- PREPARED, NOT APPLIED. Written in response to a real, live client-path
-- test (ESCROW_RLS_NEGATIVE_TEST_REPORT.md tests 6-8, this session):
-- a direct PATCH to public.milestones setting status='paid',
-- status='in_progress', and escrow_status='authorized' each returned
-- HTTP 204 (success) through the real anon-key + authenticated-JWT
-- client path, instead of the 403 permission-denied that
-- 20260812071205_...sql:427's column-level REVOKE was written to
-- guarantee.
--
-- Root cause: identical to the wallets/creator_wallets finding earlier
-- this session (PRIVILEGE_DRIFT_INVESTIGATION.md). A column-level
-- REVOKE cannot override a coexisting table-level GRANT. No migration
-- in this repo's tracked history ever issues an explicit GRANT for
-- public.milestones (confirmed via grep) -- meaning if authenticated
-- has table-level UPDATE on it, it comes from Supabase's project-level
-- default privileges, set once at project creation, outside any
-- tracked migration file -- exactly as was the case for wallets and
-- profiles.
--
-- A first draft of this migration attempted a narrow column-level
-- re-GRANT (title/description/amount/due_date only) after the
-- table-level REVOKE. That would have broken two real, legitimate
-- client call sites that write `status` directly for non-payment
-- workflow reasons -- src/components/project/MilestoneBoard.tsx:132-134
-- (mark in_progress/submitted/etc.) and
-- src/components/project/finance/PaymentRequestsReview.tsx:96-98 (owner
-- approves a payment request, status='approved') -- caught before
-- applying, not after. Both are migrated to a new validated RPC below
-- instead of a raw re-GRANT on `status`, since `status`'s legitimate
-- values (pending/in_progress/submitted/approved) and its one
-- forbidden value (paid) can't be separated by a column-level GRANT --
-- only by validating the actual value inside a function.
-- ============================================================

REVOKE UPDATE ON public.milestones FROM authenticated, anon;

-- Non-sensitive fields remain directly client-editable (unaffected by
-- the removal above until re-granted here) -- title/description/amount/
-- due_date at draft time. amount is included because it's editable at
-- creation/draft only in the existing UI; create-milestone-payment
-- always re-reads the DB row at charge time regardless of what this
-- grants, so this does not reopen the "trust the client for amount"
-- issue that function was already careful to avoid.
GRANT UPDATE (title, description, amount, due_date, updated_at)
  ON public.milestones TO authenticated;

-- status/paid_at/paid_to/escrow_status stay off the direct-write list
-- entirely. The one remaining legitimate direct-client need --
-- transitioning `status` between its four non-payment values
-- (pending/in_progress/submitted/approved) -- goes through this
-- validated RPC instead, which hard-rejects 'paid' and requires
-- project-collaborator (or, for 'approved' specifically, project-owner)
-- authorization rather than trusting RLS row-visibility alone.
CREATE OR REPLACE FUNCTION public.update_milestone_workflow_status(_milestone_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _milestone RECORD;
  _project RECORD;
  _is_owner boolean;
  _is_collaborator boolean;
BEGIN
  IF _status NOT IN ('requested', 'pending', 'in_progress', 'submitted', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO _milestone FROM public.milestones WHERE id = _milestone_id;
  IF _milestone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'milestone_not_found');
  END IF;

  SELECT * INTO _project FROM public.projects WHERE id = _milestone.project_id;
  IF _project IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'project_not_found');
  END IF;

  _is_owner := auth.uid() IS NOT NULL AND auth.uid() IN (_project.created_by, _project.client_user_id);

  -- 'approved' specifically is owner-only, matching the existing
  -- PaymentRequestsReview.tsx UI gate (isOwner) this RPC now actually
  -- enforces server-side instead of trusting.
  IF _status = 'approved' THEN
    IF NOT _is_owner THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
    END IF;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.project_collaborators
      WHERE project_id = _milestone.project_id
        AND user_id = auth.uid()
        AND status = 'accepted'
    ) INTO _is_collaborator;

    IF NOT (_is_owner OR _is_collaborator) THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
    END IF;
  END IF;

  UPDATE public.milestones SET status = _status, updated_at = now() WHERE id = _milestone_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_milestone_workflow_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_milestone_workflow_status(uuid, text) TO authenticated;

-- status='paid' / paid_at / paid_to / escrow_status remain writable only via:
--   - public.confirm_milestone_paid_offline(uuid)          (SECURITY DEFINER, already exists)
--   - capture-milestone-payment edge function's service-role client
-- Both bypass grantee-level privileges entirely, unaffected by the REVOKE above.
--
-- Note, found while writing this: src/components/project/MilestoneBoard.tsx's
-- UI references status values 'review' and 'completed', neither of which is
-- in the actual CHECK constraint on this column
-- (20260506234034_...sql:5 -- requested/pending/in_progress/submitted/
-- approved/paid only). That mismatch pre-dates this migration and is not
-- caused or fixed by it -- the RPC below rejects 'review'/'completed' the
-- same way the raw column write it replaces already would have (as an
-- invalid-value rejection, previously a Postgres CHECK violation, now this
-- RPC's own explicit check). Worth a separate look at whether the UI or the
-- constraint is the one that's actually wrong, out of scope here.
