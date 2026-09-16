-- Self-inflicted regression, caught in this session's own audit:
-- 20260912130000_minimal_org_workspace_layer.sql added projects.org_id
-- as intentionally NOT client-writable ("org assignment should go
-- through a future RPC ... once that flow exists"). One hour later,
-- 20260912140000_repair_projects_grants_new_room_regression.sql's
-- dynamic re-GRANT loop ran against the live schema, found org_id
-- already present, and -- since the loop's exclusion list only ever
-- named the four financial columns -- granted it SELECT+UPDATE anyway.
-- Exactly the "exclusion list doesn't include a newly-sensitive column"
-- bug class this repo has hit repeatedly (milestones/invoices/profiles).
--
-- Not yet exploited: no frontend code writes projects.org_id (no org UI
-- exists yet). But once one ships, this drift would let any project
-- owner attach their project to an arbitrary organizations.id with no
-- membership check, silently, because nobody would think to re-check a
-- grant that "was already fixed."
--
-- Fix: same REVOKE-then-narrow-GRANT pattern, exclusion list now also
-- covers org_id. UPDATE is fully re-excluded (matches the original
-- intent); SELECT is left granted -- reading which org a project
-- belongs to is not sensitive on its own and no comment ever said
-- otherwise, only writing it was meant to be blocked.

REVOKE UPDATE ON public.projects FROM authenticated, anon;

DO $$
DECLARE
  _col text;
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
      AND column_name NOT IN ('client_price', 'creative_payout', 'margin_type', 'margin_value', 'org_id')
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.projects TO authenticated', _col);
  END LOOP;
END $$;
