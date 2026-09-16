-- ============================================================
-- Security hardening phase 2. Companion to 20260910130000, which locked
-- down SELECT on projects.client_price/creative_payout/margin_type/
-- margin_value. UPDATE on the same four columns was never separately
-- restricted anywhere in this repo's migration history -- only the
-- early, blanket `GRANT ...UPDATE... ON public.projects TO authenticated`
-- statements exist, so any RLS policy permitting a row-level UPDATE
-- (e.g. project owner editing their project) could also directly rewrite
-- these financial columns.
--
-- Confirmed via grep across src/: there is no frontend write path to
-- these four columns at all today (src/hooks/useProjectData.ts:156's own
-- comment: "client_price/creative_payout/margin_type/margin_value are no
-- [longer directly selected]" -- reads go through get_project_financials()
-- exclusively). Locking UPDATE is a pure gap-fill, not a behavior change
-- for any existing feature.
--
-- Fix: table-level REVOKE UPDATE, then re-GRANT every column except the
-- four financial ones -- same pattern as 20260904180000 (invoices) and
-- 20260824100000 (milestones). Legitimate financial writes, if a real one
-- is ever needed, should get their own update_project_financials() RPC
-- following the same pattern as update_milestone_workflow_status, per
-- 20260825100000's own "deliberately out of scope" note.
--
-- Idempotent: REVOKE/GRANT are naturally idempotent, no guard needed.
-- ============================================================

REVOKE UPDATE ON public.projects FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name NOT IN ('client_price', 'creative_payout', 'margin_type', 'margin_value')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.projects TO authenticated', _col);
  END LOOP;
END $$;
