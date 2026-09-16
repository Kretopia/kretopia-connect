-- Two confirmed, currently-open RLS gaps found while auditing this
-- session's own money-column work (same "table-level GRANT survives a
-- column-level REVOKE" root cause already fixed for milestones/invoices/
-- profiles/creator_wallets elsewhere in this repo's history).
--
-- 1. public.projects -- UPDATE was never table-level REVOKEd at all.
--    client_price/creative_payout/margin_type/margin_value are already
--    correctly excluded from SELECT (20260825100000 + the table-level fix
--    in 20260910130000) and are readable only via the owner-only
--    get_project_financials() RPC. But nothing ever revoked UPDATE on
--    these same columns: "Users can update accessible projects" has no
--    WITH CHECK (reuses its USING clause) and no column restriction, and
--    user_has_project_access() returns true for ANY project_collaborators
--    row with status IN ('accepted','pending') regardless of role --
--    including 'guest'/'client' roles, which are explicitly the roles
--    excluded from seeing this same money by can_see_milestone_money()'s
--    sibling logic. Net effect: a guest/client collaborator (or even a
--    merely-invited, not-yet-accepted one) who cannot read these columns
--    can still blind-write them via a raw PATCH. Confirmed via grep: no
--    frontend code anywhere writes these 4 columns today (the
--    update_project_financials() RPC 20260825100000 flagged as a future
--    TODO was never built) -- REVOKEing UPDATE on them breaks no existing
--    flow.
--
-- 2. public.invoices.bank_transfer_reported_at -- 20260902013000 (SEPA
--    bank-transfer flow) correctly column-REVOKEd this two days before
--    20260904180000's later, broader "REVOKE UPDATE ON invoices, re-GRANT
--    every column except (status, paid_at)" fix -- but that exclusion
--    list didn't include bank_transfer_reported_at, so the table-level
--    re-GRANT silently re-opened direct client UPDATE on it. The
--    legitimate write path (supabase/functions/invoice-report-bank-transfer)
--    uses the service-role key and is unaffected by any authenticated/anon
--    grant change.

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

REVOKE UPDATE ON public.invoices FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices'
      AND column_name NOT IN ('status', 'paid_at', 'bank_transfer_reported_at')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.invoices TO authenticated', _col);
  END LOOP;
END $$;
