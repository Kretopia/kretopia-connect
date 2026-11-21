-- LOT K2 -- truthful action and run statuses, and what each run used -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after
-- 01_preflight.sql returned its findings. One transaction. It adds three enum labels, replaces lot E's guard function with the same function
-- plus the new paths, and adds two nullable columns (and, only if they are missing, model and tool_names as 20260915100000 defines them).
-- It changes no row.
--
-- Compatibility: the deployed code never writes the new labels, so for it nothing changes; every path lot E allows is still allowed (the
-- stale-run reconciler's approved -> failed and proposed -> rejected included). Readers that list statuses keep working; the legacy schema
-- types file (src/integrations/... legacy types) needs the new labels only when code starts writing them.
-- Postgres cannot remove an enum label: 04_rollback.sql restores lot E's guard and drops the two columns, and leaves the labels unused.
-- Order: SQL first; the code that writes the new statuses and columns comes later, in its own pull request.

BEGIN;

DO $assert$
BEGIN
  IF to_regprocedure('public.guard_orch_action_transitions()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_orch_action_transitions' AND tgrelid = 'public.orch_actions'::regclass) THEN
    RAISE EXCEPTION 'APPLY STOPPED: lot E is not applied. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_runs' AND column_name IN ('profile', 'effort')) THEN
    RAISE EXCEPTION 'APPLY STOPPED: orch_runs already has a profile or effort column (lot K2 applied?). Nothing was changed.';
  END IF;
END
$assert$;

-- Allowed inside a transaction since PostgreSQL 12; the labels become usable once this transaction commits.
ALTER TYPE public.orch_action_status ADD VALUE IF NOT EXISTS 'unknown';
ALTER TYPE public.orch_action_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.orch_run_status ADD VALUE IF NOT EXISTS 'partial';

-- Lot E's guard, unchanged except for the four marked paths.
CREATE OR REPLACE FUNCTION public.guard_orch_action_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.status <> 'proposed' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.tool_name IS DISTINCT FROM OLD.tool_name
       OR NEW.tool_args IS DISTINCT FROM OLD.tool_args
       OR NEW.run_id IS DISTINCT FROM OLD.run_id
       OR NEW.risk_level IS DISTINCT FROM OLD.risk_level THEN
      RAISE EXCEPTION 'a decided agent action cannot change its owner, tool, arguments, run or risk level' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'proposed' AND NEW.status::text IN ('approved', 'rejected', 'auto_executed', 'executed', 'failed',
                                                         'unknown', 'cancelled'))          -- K2: an auto-run that may have acted; a withdrawn proposal
    OR (OLD.status = 'approved' AND NEW.status::text IN ('executed', 'failed', 'proposed',
                                                         'unknown'))                       -- K2: the connection dropped after the tool was called
    OR (OLD.status = 'executed' AND NEW.status::text IN ('approved', 'failed'))
    OR (OLD.status::text = 'unknown' AND NEW.status::text IN ('executed', 'failed'))       -- K2: a person checked what happened
  ) THEN
    RAISE EXCEPTION 'agent action status cannot go from % to %', OLD.status, NEW.status USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$fn$;

ALTER TABLE public.orch_runs
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS tool_names TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN profile TEXT,
  ADD COLUMN effort SMALLINT;
ALTER TABLE public.orch_runs
  ADD CONSTRAINT orch_runs_profile_shape CHECK (profile IS NULL OR profile ~ '^[a-z][a-z0-9_]{1,31}$'),
  ADD CONSTRAINT orch_runs_effort_range CHECK (effort IS NULL OR effort BETWEEN 1 AND 4);
COMMENT ON COLUMN public.orch_runs.profile IS 'Kreto profile the run used (kretoProfiles.ts id, resolved from Auto). Written by the server only.';
COMMENT ON COLUMN public.orch_runs.effort IS 'Effort 1-4 the run used (kretoProfiles.ts). Written by the server only.';

COMMIT;

SELECT 'applied' AS result,
       (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = 'public.orch_action_status'::regtype) AS action_statuses,
       (SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = 'public.orch_run_status'::regtype) AS run_statuses,
       'now run 03_verify.sql' AS next_step;
