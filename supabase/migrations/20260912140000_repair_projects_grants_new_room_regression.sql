-- Live bug report: "permission denied for table projects" when creating
-- a project via the New Room flow
-- (src/components/project/studio/VoiceFirstCreateModal.tsx's createProject(),
-- `supabase.from("projects").insert({...}).select().single()`).
--
-- No migration in this repo's history ever REVOKEs INSERT on
-- public.projects (confirmed via grep) -- the original blanket
-- `GRANT INSERT, SELECT, UPDATE, DELETE ON public.projects TO authenticated`
-- (20251005012834/20251005013601) is still the only statement touching
-- INSERT specifically. What HAS happened twice on this exact table this
-- week is a table-level REVOKE + dynamic per-column re-GRANT for SELECT
-- (20260910130000) and for UPDATE (577211fb / 20260910190000) --
-- exactly the same "table-level REVOKE, then re-GRANT computed from
-- information_schema.columns AT APPLY TIME" pattern that this repo's own
-- history shows has drifted out of sync with the live schema more than
-- once already (milestones, invoices, profiles all had the identical
-- symptom: a column-level fix that looked correct in git but didn't
-- match what was actually granted live).
--
-- `.insert({...}).select().single()` needs a working SELECT grant on
-- every column of the row PostgREST returns, immediately after the
-- INSERT, using the same authenticated role -- if that SELECT grant is
-- missing or stale for even one column New Room writes
-- (workspace_type/deal_type/track_as_credit/setup_completed/budget/
-- deadline), the whole statement fails with exactly this error, even
-- though the INSERT itself would have succeeded.
--
-- This is a repair, not a new policy: idempotently re-asserts the
-- correct, current grant state for INSERT/SELECT/UPDATE on
-- public.projects, computed fresh against whatever columns actually
-- exist right now rather than trusting an entry in git history to still
-- match. Safe to run any number of times; changes nothing for
-- client_price/creative_payout/margin_type/margin_value, which stay
-- locked down exactly as already decided.

GRANT INSERT ON public.projects TO authenticated;

REVOKE SELECT ON public.projects FROM authenticated;
REVOKE UPDATE ON public.projects FROM authenticated;

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
    EXECUTE format('GRANT UPDATE (%I) ON public.projects TO authenticated', _col);
  END LOOP;
END $$;
