-- ============================================================================
-- Close self/peer-attestation trust-escalation gaps found in the release
-- security audit (docs/SECURITY_RELEASE_GATE.md, findings C2, C3, C6, C7, C9,
-- C11). Root cause pattern in every case: an owner-scoped UPDATE/INSERT policy
-- with no column restriction let a client write a trust or payment-state
-- column directly. Fix pattern mirrors what's already proven safe elsewhere
-- in this repo for wallet_transfers/wallet_debit/wallet_credit
-- (20260804103153_2e1c09c1...sql) and admin_confirm_bank_transfer
-- (20260417191317...sql): REVOKE the specific columns from `authenticated`,
-- then provide narrow SECURITY DEFINER RPCs, each with its own real
-- ownership/role check, as the only legitimate write path.
--
-- Deliberately NOT included here (separate findings, not requested in this
-- pass): C4 (wallets.balance), C5 (creator_wallets.payouts_enabled),
-- C8 (verify-credit auth), C10 (badge/tooltip UI honesty), C12 (Privacy
-- Policy copy).
-- ============================================================================


-- ============================================================================
-- C2 — profiles: lock down trust/verification/billing columns
-- ============================================================================

REVOKE UPDATE (
  id_verified, id_verified_at,
  verification_status, verification_score, verification_notes, verified_at,
  verification_tier,
  subscription_tier, subscription_status,
  stripe_account_id, stripe_account_status,
  badge
) ON public.profiles FROM authenticated, anon;

-- Self-service: a user may REQUEST id verification (submits evidence for
-- admin review) without being able to grant it to themselves. Separate,
-- narrow, client-writable column — not covered by the REVOKE above.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.request_id_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET id_verification_requested_at = now()
  WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.request_id_verification() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_id_verification() TO authenticated;

-- Admin-only: the actual grant/reject of ID verification. Fixes a live
-- functional bug found alongside the security gap — VerificationTab.tsx's
-- admin approve/reject buttons update the `profiles` row of *another* user
-- directly from the browser client; with no admin UPDATE policy on
-- `profiles` (and now, even less so with the column-level REVOKE above),
-- that direct update was already silently affecting 0 rows. This RPC is
-- both the security fix and the functional fix.
CREATE OR REPLACE FUNCTION public.admin_verify_profile_identity(
  p_user_id uuid,
  p_approved boolean,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can verify identity';
  END IF;

  UPDATE public.profiles
  SET
    id_verified = p_approved,
    id_verified_at = CASE WHEN p_approved THEN now() ELSE NULL END,
    verification_status = CASE WHEN p_approved THEN 'verified' ELSE 'rejected' END,
    verified_at = CASE WHEN p_approved THEN now() ELSE verified_at END,
    verification_notes = COALESCE(p_notes, verification_notes)
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'approved', p_approved);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_verify_profile_identity(uuid, boolean, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_profile_identity(uuid, boolean, text) TO authenticated;
-- (Function itself enforces the admin role check above; GRANT to
-- `authenticated` is required for any logged-in caller to even reach that
-- check — non-admins are rejected inside the function body, matching
-- admin_confirm_bank_transfer's existing pattern in this codebase.)


-- ============================================================================
-- C3 / C9 — credits.verification_status: close every self/peer-attestation
-- path to "verified", fix the unguarded increment_endorsement_count RPC
-- ============================================================================

-- A BEFORE INSERT OR UPDATE trigger (not a column REVOKE) is used here
-- because the same column legitimately needs different treatment depending
-- on the *value* being written, not just *who* is writing: a user may
-- freely downgrade their own credit to 'unverified'/'rejected' (e.g.
-- ImportReviewBanner's "not mine" action), but escalating a row to
-- 'verified' or 'auto_discovered' must never come from a raw client
-- INSERT/UPDATE — only from a service-role edge function (genuine
-- authoritative-source import) or from inside a SECURITY DEFINER RPC that
-- has done its own real ownership/collaborator check and explicitly
-- authorizes the escalation for this one statement.
CREATE OR REPLACE FUNCTION public.guard_credit_verification_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IN ('verified', 'auto_discovered')
     AND (TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status)
     AND auth.role() <> 'service_role'
     AND current_setting('app.credit_verification_authorized', true) IS DISTINCT FROM 'true'
  THEN
    RAISE EXCEPTION 'verification_status cannot be escalated to % directly — use an authorized verification RPC', NEW.verification_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_credit_verification_escalation ON public.credits;
CREATE TRIGGER guard_credit_verification_escalation
  BEFORE INSERT OR UPDATE ON public.credits
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_credit_verification_escalation();

-- increment_endorsement_count: previously had NO auth/ownership check at
-- all — any authenticated caller could call it directly with an arbitrary
-- credit_id_param and escalate a stranger's credit toward 'verified'. Now
-- requires the caller to actually hold a matching *accepted*
-- credit_endorsements row (the real, identity-bound endorsement they just
-- responded to — CreditVerificationPanel.tsx's existing UI flow already
-- creates this row before calling the RPC, so the legitimate path is
-- unaffected) or be a tagged collaborator on the credit itself.
CREATE OR REPLACE FUNCTION public.increment_endorsement_count(credit_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_authorized boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.credit_endorsements
    WHERE credit_id = credit_id_param
      AND endorser_id = auth.uid()
      AND status = 'accepted'
  ) OR EXISTS (
    SELECT 1 FROM public.credits
    WHERE id = credit_id_param
      AND auth.uid() = ANY(COALESCE(collaborator_user_ids, ARRAY[]::uuid[]))
  ) INTO v_authorized;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'You are not authorized to endorse this credit';
  END IF;

  PERFORM set_config('app.credit_verification_authorized', 'true', true);

  UPDATE credits
  SET endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        WHEN COALESCE(endorsement_count, 0) + 1 >= 1 THEN 'pending'
        ELSE verification_status
      END
  WHERE id = credit_id_param;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_endorsement_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.increment_endorsement_count(uuid) TO authenticated;

-- Safe downgrade RPC for ImportReviewBanner's "not mine" action (was a raw
-- .update({verification_status:'unverified'}) call — still owner-scoped,
-- still safe, but now needs to go through a function since the trigger
-- above governs the same column; downgrades don't need special
-- authorization, they're the safe direction, so this just re-asserts
-- ownership and performs the update).
CREATE OR REPLACE FUNCTION public.reject_discovered_credit(credit_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.credits
  SET verification_status = 'unverified'
  WHERE id = credit_id_param AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit not found or not owned by caller';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_discovered_credit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reject_discovered_credit(uuid) TO authenticated;

-- Self-service claim RPC for the two C9 self-attestation paths (ICDB
-- one-click claim, project-owner self-confirm) — these no longer insert
-- verification_status='verified' directly (blocked by the trigger above
-- regardless); this RPC gives them an honest, correctly-gated 'pending'
-- outcome instead of erroring, and centralizes the icdb_project_roles
-- claim-marking transaction that CreditDatabase.tsx / ICDBProjectPage.tsx
-- previously did as two separate unguarded client calls.
CREATE OR REPLACE FUNCTION public.claim_icdb_role(p_role_id uuid, p_thumbnail_url text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role RECORD;
  v_project RECORD;
  v_credit_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_role FROM public.icdb_project_roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found'; END IF;
  IF v_role.is_claimed THEN RAISE EXCEPTION 'Role already claimed'; END IF;

  SELECT * INTO v_project FROM public.icdb_projects WHERE id = v_role.project_id;

  UPDATE public.icdb_project_roles
  SET claimed_by = auth.uid(), is_claimed = true
  WHERE id = p_role_id;

  PERFORM set_config('app.credit_verification_authorized', 'true', true);

  INSERT INTO public.credits (
    user_id, project_name, role, year, platform, location,
    client_brand, project_type, verification_status, url, thumbnail_url
  ) VALUES (
    auth.uid(), v_project.title, v_role.role_title, v_project.year, v_project.platform,
    v_project.location, v_project.client_brand, v_project.type, 'pending', v_project.external_url,
    p_thumbnail_url
  )
  RETURNING id INTO v_credit_id;

  RETURN jsonb_build_object('success', true, 'credit_id', v_credit_id);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_icdb_role(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_icdb_role(uuid, text) TO authenticated;

-- Two pre-existing, legitimate SECURITY DEFINER RPCs write 'verified'/
-- 'auto_discovered' to credits.verification_status directly and would be
-- blocked by the trigger above the moment it's added — neither previously
-- needed to authorize itself for anything, because nothing was guarding
-- this column before. Re-declaring both here with the one line each needs
-- (PERFORM set_config(...)) added immediately before their existing write;
-- everything else is byte-for-byte identical to their current definitions
-- (20260807120000_discovered_credit_not_verified.sql and
-- 20260806054700_prevent_self_cosign.sql respectively) — this is not a
-- behavior change to either function, only an unblock.

-- approve_discovered_credit: the real "confirm this AI-found credit is
-- mine" action (DiscoveriesInbox.tsx / PendingDiscoveriesDialog.tsx).
CREATE OR REPLACE FUNCTION public.approve_discovered_credit(_discovery_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _d RECORD;
  _new_credit_id UUID;
  _existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _d FROM public.discovered_credits
  WHERE id = _discovery_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Discovery not found');
  END IF;

  IF _d.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already ' || _d.status);
  END IF;

  SELECT id INTO _existing FROM public.credits
  WHERE user_id = auth.uid()
    AND lower(project_name) = lower(_d.project_name)
    AND lower(coalesce(role,'')) = lower(coalesce(_d.role,''))
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    UPDATE public.discovered_credits
    SET status = 'approved', approved_credit_id = _existing, approved_at = now()
    WHERE id = _discovery_id;
    RETURN jsonb_build_object('success', true, 'credit_id', _existing, 'note', 'already_existed');
  END IF;

  PERFORM set_config('app.credit_verification_authorized', 'true', true);

  INSERT INTO public.credits (
    user_id, project_name, role, year, credit_category, platform, url,
    thumbnail_url, description, ai_confidence, source, verification_status
  ) VALUES (
    auth.uid(), _d.project_name, _d.role, _d.year, _d.credit_category, _d.platform, _d.url,
    _d.thumbnail_url, _d.description, _d.ai_confidence, COALESCE(_d.source, 'discovery'), 'auto_discovered'
  )
  RETURNING id INTO _new_credit_id;

  UPDATE public.discovered_credits
  SET status = 'approved', approved_credit_id = _new_credit_id, approved_at = now()
  WHERE id = _discovery_id;

  RETURN jsonb_build_object('success', true, 'credit_id', _new_credit_id);
END;
$$;

-- submit_credit_endorsement_by_token: the actual Co-Sign completion path
-- (token/anon flow for external collaborators without a Kretopia account).
-- This is the RPC the whole Co-Sign feature depends on — without this fix,
-- the second accepted co-sign on any credit would throw and roll back.
CREATE OR REPLACE FUNCTION public.submit_credit_endorsement_by_token(
  _token TEXT,
  _accepted BOOLEAN,
  _endorser_name TEXT DEFAULT NULL,
  _relationship TEXT DEFAULT NULL,
  _testimonial TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _endorsement RECORD;
  _new_count INTEGER;
  _caller UUID := auth.uid();
BEGIN
  SELECT ce.id, ce.credit_id, ce.status, ce.requested_by
  INTO _endorsement
  FROM public.credit_endorsements ce
  WHERE ce.token = _token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Verification link not found');
  END IF;

  IF _endorsement.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This request has already been answered', 'status', _endorsement.status);
  END IF;

  IF _caller IS NOT NULL AND _caller = _endorsement.requested_by THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot co-sign your own credit');
  END IF;

  UPDATE public.credit_endorsements
  SET
    status = CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    endorser_name = COALESCE(NULLIF(_endorser_name, ''), endorser_name),
    relationship = COALESCE(NULLIF(_relationship, ''), relationship),
    testimonial = CASE WHEN _accepted THEN NULLIF(_testimonial, '') ELSE NULL END,
    endorser_id = COALESCE(endorser_id, _caller),
    responded_at = now()
  WHERE id = _endorsement.id;

  IF _accepted THEN
    PERFORM set_config('app.credit_verification_authorized', 'true', true);

    UPDATE public.credits
    SET
      endorsement_count = COALESCE(endorsement_count, 0) + 1,
      verification_status = CASE
        WHEN COALESCE(endorsement_count, 0) + 1 >= 2 THEN 'verified'
        ELSE 'peer'
      END
    WHERE id = _endorsement.credit_id
    RETURNING endorsement_count INTO _new_count;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN _accepted THEN 'accepted' ELSE 'declined' END,
    'endorsement_count', COALESCE(_new_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_credit_endorsement_by_token(TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ============================================================================
-- C6 — milestones: only the paying client/project owner may confirm an
-- offline ("mark paid manually") payment, not any collaborator
-- ============================================================================

REVOKE UPDATE (status, paid_at, paid_to, escrow_status) ON public.milestones FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.confirm_milestone_paid_offline(p_milestone_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_milestone RECORD;
  v_project RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_milestone FROM public.milestones WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Milestone not found'; END IF;
  IF v_milestone.status = 'paid' THEN
    RAISE EXCEPTION 'Milestone already paid';
  END IF;

  SELECT * INTO v_project FROM public.projects WHERE id = v_milestone.project_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;

  -- Same authorization boundary already proven correct for real Stripe
  -- escrow release (supabase/functions/_shared/escrowAuth.ts) — the payer
  -- (client_user_id) or project owner, never "any collaborator." Uses
  -- IS DISTINCT FROM rather than NOT IN: client_user_id is nullable, and
  -- `x NOT IN (NULL, y)` evaluates to NULL (not TRUE) whenever x <> y,
  -- which PL/pgSQL's IF treats as false — silently skipping the check
  -- for exactly the projects that have no client_user_id set.
  IF auth.uid() IS DISTINCT FROM v_project.client_user_id
     AND auth.uid() IS DISTINCT FROM v_project.created_by THEN
    RAISE EXCEPTION 'Only the paying client can confirm this milestone as paid';
  END IF;

  -- created_by is the creator being paid (matches the recipient convention
  -- already used consistently by the real Stripe paths: batch-milestone-
  -- payout, capture-milestone-payment, stripe-marketplace-webhook). The
  -- previous client code set paid_to to the *confirmer's* own id, which
  -- was wrong whenever the confirmer wasn't also the recipient.
  UPDATE public.milestones
  SET status = 'paid', paid_at = now(), paid_to = created_by
  WHERE id = p_milestone_id;

  RETURN jsonb_build_object('success', true, 'milestone_id', p_milestone_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_milestone_paid_offline(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_milestone_paid_offline(uuid) TO authenticated;


-- ============================================================================
-- C7 — invoices: issuer can still self-report an offline payment (there is
-- often no alternative — the payer may have no Kretopia account at all,
-- e.g. a bank-transfer client) but it must go through an audited RPC that
-- requires a real payment-method note, not a bare, untracked column flip
-- ============================================================================

REVOKE UPDATE (status, paid_at) ON public.invoices FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.confirm_invoice_paid_manually(
  p_invoice_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_payment_method IS NULL OR length(trim(p_payment_method)) = 0 THEN
    RAISE EXCEPTION 'A payment method note is required to record a manual payment';
  END IF;

  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.issued_by <> auth.uid() THEN
    RAISE EXCEPTION 'Only the issuer can record this invoice as manually paid';
  END IF;
  IF v_invoice.status = 'paid' THEN
    RAISE EXCEPTION 'Invoice already paid';
  END IF;

  UPDATE public.invoices
  SET status = 'paid', paid_at = now(), payment_method = p_payment_method
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_invoice_paid_manually(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_invoice_paid_manually(uuid, text) TO authenticated;


-- ============================================================================
-- C11 — identity_face_verified must reflect a real, server-computed
-- face-match result, not a client-replayed number. verify-profile-claim
-- (the AI comparison function) now writes its real result to this table
-- under service_role before returning a one-time token to the caller;
-- claim-and-create-profile consumes that token server-side instead of
-- trusting a client-supplied face_match_score.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.face_verification_attempts (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verified boolean NOT NULL,
  confidence numeric,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.face_verification_attempts ENABLE ROW LEVEL SECURITY;
-- No client policies at all — this table is written and read exclusively
-- by service-role edge functions (verify-profile-claim writes,
-- claim-and-create-profile reads-and-consumes). Deliberately no SELECT
-- policy either: the token itself is the only thing the client ever needs
-- to hold, and it's opaque (a random UUID), not guessable.
GRANT ALL ON public.face_verification_attempts TO service_role;

-- Housekeeping: attempts are single-use and short-lived: nothing needs to
-- read a row older than the token's validity window, so this is safe as a
-- routine cleanup even if it never runs — kept for tidiness, not correctness.
CREATE INDEX IF NOT EXISTS face_verification_attempts_created_at_idx
  ON public.face_verification_attempts (created_at);