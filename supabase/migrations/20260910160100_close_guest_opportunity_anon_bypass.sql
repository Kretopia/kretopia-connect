-- ============================================================
-- Security hardening phase 2 -- CRITICAL. Found via background audit
-- (2026-09-10): the anon INSERT policy on public.opportunities
-- ("Anyone can create guest opportunities", 20260213015251:13-17) only
-- checks `is_guest_post = true AND guest_email IS NOT NULL` -- nothing
-- constrains `status`, which defaults to 'active'
-- (20250930073034:26). Combined with the current SELECT policy
-- ("Public can view active opportunities", 20260408223410:6-8,
-- `USING (status = 'active')`, no TO clause = PUBLIC), an unauthenticated
-- caller can INSERT a row with status left at its default and have it go
-- immediately, publicly live -- a full bypass of both intended gates:
--   1. Email verification (verify-guest-opportunity/index.ts, which
--      correctly inserts status: 'pending_verification' and only flips
--      to 'active' after the emailed token is confirmed).
--   2. AI content moderation (moderate-opportunity), which the frontend
--      may optionally call before inserting but which nothing enforces
--      server-side.
-- `created_by` is also unconstrained by this policy despite being
-- nullable specifically for guest posts (20260213074431) -- a caller
-- could pass an arbitrary existing user's UUID as created_by, falsely
-- attributing a guest/spam post to a real, unrelated user.
--
-- Fix: narrow the WITH CHECK to force every anon-submitted guest post
-- through the same funnel the legitimate verify-guest-opportunity
-- function already uses -- unverified, unpublished, and never
-- attributed to a real user. Does not touch the SELECT policy: once
-- anon-submitted rows can never reach status='active' directly, the
-- existing `status = 'active'` SELECT check is sufficient on its own
-- (a row only reaches 'active' via the service-role verify function,
-- which bypasses RLS and sets verified_at + status together).
--
-- Idempotent: DROP POLICY IF EXISTS before recreating.
-- ============================================================

DROP POLICY IF EXISTS "Anyone can create guest opportunities" ON public.opportunities;

CREATE POLICY "Anyone can create guest opportunities"
  ON public.opportunities
  FOR INSERT
  TO anon
  WITH CHECK (
    is_guest_post = true
    AND guest_email IS NOT NULL
    AND created_by IS NULL
    AND status = 'pending_verification'
    AND verified_at IS NULL
  );
