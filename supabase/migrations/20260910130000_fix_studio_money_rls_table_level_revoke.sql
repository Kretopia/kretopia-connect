-- ============================================================
-- Fixes a live gap in 20260825100000_studio_role_based_money_rls.sql.
--
-- That migration REVOKEs the financial columns at COLUMN level:
--   REVOKE SELECT (amount, paid_to, paid_at, escrow_status, payment_intent_id)
--     ON public.milestones FROM authenticated, anon;
--   REVOKE SELECT (client_price, creative_payout, margin_type, margin_value)
--     ON public.projects FROM authenticated, anon;
--
-- Confirmed live in production (2026-09-10), after that migration had
-- already been applied:
--   - milestones: a direct REST SELECT of amount/escrow_status/paid_to
--     with an ordinary authenticated session SUCCEEDED and returned real
--     values -- the REVOKE had no effect. Live gap, confirmed.
--   - projects: the equivalent SELECT of client_price/creative_payout/
--     margin_type/margin_value correctly returned 403 42501 permission
--     denied -- this table is NOT leaking. Included below anyway, purely
--     for consistency with the pattern and as a no-op safety net (REVOKE/
--     GRANT are idempotent); it is not fixing a confirmed issue there.
--
-- Most likely explanation for the milestones-only gap: a column-level
-- REVOKE does not remove a pre-existing TABLE-level SELECT grant, and
-- unlike projects (which had its anon table-level SELECT already fully
-- revoked by 20260825110000_close_public_recap_rls_gap.sql, suggesting
-- its grants were already narrower going in), milestones had never had
-- a table-level SELECT REVOKE applied before this file -- only UPDATE was
-- previously locked down at table level, in
-- 20260824100000_milestones_privilege_hardening.sql. So a leftover
-- blanket table-level SELECT grant for authenticated most likely still
-- covers milestones' financial columns regardless of the column-level
-- REVOKE. Not independently confirmed via information_schema (the
-- verification session couldn't query it directly), but the fix below
-- is correct and safe regardless of the exact mechanism.
--
-- Fix: REVOKE SELECT at the TABLE level (removing any blanket grant
-- entirely), then re-GRANT only the non-financial columns -- the same
-- pattern already proven live in this same verification round (direct
-- wallets.balance write returns 42501 permission denied).
--
-- Idempotent: REVOKE/GRANT are naturally idempotent, no guard needed.
-- ============================================================

REVOKE SELECT ON public.milestones FROM authenticated, anon;

GRANT SELECT (id, project_id, title, description, status, due_date,
  created_by, requested_by, created_at, updated_at,
  external_id, external_url, import_job_id, imported_at, source_provider)
  ON public.milestones TO authenticated;

REVOKE SELECT ON public.projects FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name NOT IN ('client_price', 'creative_payout', 'margin_type', 'margin_value')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.projects TO authenticated', _col);
  END LOOP;
END $$;
