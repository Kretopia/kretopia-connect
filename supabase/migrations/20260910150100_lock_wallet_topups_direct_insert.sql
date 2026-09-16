-- ============================================================
-- Security hardening phase 2, defense-in-depth companion to the
-- wallet-topup-confirm/index.ts fix landing in the same batch.
--
-- public.wallet_topups' only INSERT policy ("Users can create their own
-- topups", 20260306101009:72-74) checks only `user_id = auth.uid()` --
-- no restriction on status/amount/payment_gateway/gateway_session_id, so
-- a client could INSERT a row with status='completed' or an arbitrary
-- payment_gateway/amount directly via the REST API.
--
-- Confirmed via grep across src/: the frontend never inserts into
-- wallet_topups directly. The only legitimate writer is
-- wallet-topup/index.ts, which uses the service_role client (bypasses
-- RLS entirely) to create the row before creating the real Stripe
-- Checkout session. This RLS policy is therefore unused by any real
-- feature today -- a pure, safe-to-close attack surface, not a behavior
-- change.
--
-- Idempotent: DROP POLICY IF EXISTS before recreating; REVOKE is
-- naturally idempotent.
-- ============================================================

DROP POLICY IF EXISTS "Users can create their own topups" ON public.wallet_topups;

REVOKE INSERT, UPDATE, DELETE ON public.wallet_topups FROM authenticated, anon;
