-- Flagged in this session's own audit: 20260910130000's milestones fix
-- diverged from every other table's REVOKE+dynamic-re-GRANT pattern and
-- used a hardcoded column allowlist instead:
--   GRANT SELECT (id, project_id, title, description, status, due_date,
--     created_by, requested_by, created_at, updated_at,
--     external_id, external_url, import_job_id, imported_at, source_provider)
--     ON public.milestones TO authenticated;
--
-- No column has been added to milestones since, so there's no live gap
-- today -- but this is a worse foot-gun than the usual drift bug: the
-- next ALTER TABLE milestones ADD COLUMN (even something totally benign)
-- gets ZERO grant at all, silently breaking reads, and it won't even
-- look like the fragile "information_schema loop" pattern this repo's
-- own history has taught everyone to double-check.
--
-- Fix: convert to the same dynamic-exclusion-list pattern already used
-- for projects/invoices/profiles -- functionally identical grant today
-- (same 15 columns end up granted), but a future column addition now
-- gets swept in automatically instead of needing someone to remember
-- to touch this file.

REVOKE SELECT ON public.milestones FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'milestones'
      AND column_name NOT IN ('amount', 'paid_to', 'paid_at', 'escrow_status', 'payment_intent_id')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.milestones TO authenticated', _col);
  END LOOP;
END $$;
