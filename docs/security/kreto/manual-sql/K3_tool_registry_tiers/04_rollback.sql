-- LOT K3 -- 04 ROLLBACK. Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It puts back the tier each row had before 02_apply.sql, from public.kreto_migration_backup, but only on rows still at the tier K3 raised
-- them to (a row someone changed since is left alone and listed). Then it deletes lot K3's backup rows, and the backup table when no other
-- lot uses it.
--
-- DOES THIS REINTRODUCE A WEAKNESS? YES, for the production orchestrator, which reads only the registry: the raised tools run on their own
-- again and the three locked ones can be proposed and run by the agent again. The repository orchestrator keeps acting on the policy floor
-- either way.

BEGIN;

DO $rollback$
DECLARE
  v_skipped text;
BEGIN
  IF to_regclass('public.kreto_migration_backup') IS NULL THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: lot K3 is not applied (no backup table). Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kreto_migration_backup WHERE lot = 'K3' AND kind = 'applied') THEN
    RAISE EXCEPTION 'ROLLBACK STOPPED: lot K3 is not applied (no backup rows). Nothing was changed.';
  END IF;

  SELECT string_agg(b.object || ' (now ' || r.risk_level::text || ')', ', ') INTO v_skipped
  FROM public.kreto_migration_backup b JOIN public.orch_tool_registry r ON r.id = (b.detail ->> 'registry_id')::uuid
  WHERE b.lot = 'K3' AND b.kind = 'tier' AND r.risk_level <> (b.detail ->> 'raised_to')::public.orch_risk_level;
  IF v_skipped IS NOT NULL THEN
    RAISE NOTICE 'left alone, changed since K3: %', v_skipped;
  END IF;

  UPDATE public.orch_tool_registry r
     SET risk_level = (b.detail ->> 'risk_level')::public.orch_risk_level
    FROM public.kreto_migration_backup b
   WHERE b.lot = 'K3' AND b.kind = 'tier' AND r.id = (b.detail ->> 'registry_id')::uuid
     AND r.risk_level = (b.detail ->> 'raised_to')::public.orch_risk_level;

  DELETE FROM public.kreto_migration_backup WHERE lot = 'K3';
  IF NOT EXISTS (SELECT 1 FROM public.kreto_migration_backup) THEN
    DROP TABLE public.kreto_migration_backup;
  END IF;
END
$rollback$;

COMMIT;

SELECT 'rolled back' AS result;
