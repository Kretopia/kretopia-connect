-- LOT K2 -- truthful action and run statuses, and what each run used -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- What 02_apply.sql adds, and nothing else:
--   * two action statuses (orch_action_status): 'unknown' = "not confirmed: the tool may have acted, check before trying again" (today stored
--     as 'failed' with a note) and 'cancelled' = a proposal withdrawn before anyone decided;
--   * one run status (orch_run_status): 'partial' = some actions went through and some did not ('running' and 'cancelled' already exist);
--   * the paths lot E's guard allows for them: proposed -> unknown | cancelled, approved -> unknown, unknown -> executed | failed (a person
--     checked). Every path lot E allows today stays allowed; nothing leaves cancelled;
--   * on orch_runs: profile (the Kreto profile that ran) and effort (1-4). model and tool_names already come from migration 20260915100000;
--     if that migration never reached production, apply adds the same two columns with the same definitions.
-- Nothing writes the new values until the code is changed; existing rows are untouched.
--
-- It stops with an error if lot E's guard is missing (the transitions live in one function), or if a name is taken, then returns findings.

DO $pre$
BEGIN
  IF to_regtype('public.orch_action_status') IS NULL OR to_regtype('public.orch_run_status') IS NULL OR to_regclass('public.orch_runs') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: orch_action_status, orch_run_status or orch_runs is missing. Is this kretopia-app?';
  END IF;
  IF to_regprocedure('public.guard_orch_action_transitions()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_orch_action_transitions' AND tgrelid = 'public.orch_actions'::regclass) THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: lot E (guard_orch_action_transitions and its trigger) is not applied. Apply lot E first.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_runs' AND column_name IN ('profile', 'effort')) THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: orch_runs already has a profile or effort column.';
  END IF;
END
$pre$;

SELECT 'enum_label' AS finding, t.typname AS name, e.enumlabel AS detail, e.enumsortorder::text AS extra
FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname IN ('orch_action_status', 'orch_run_status')
UNION ALL
SELECT 'run_metadata_column', column_name, data_type, 'present (from 20260915100000)'
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_runs' AND column_name IN ('model', 'tool_names', 'tool_call_count', 'source')
UNION ALL
SELECT 'guard_source_matches_lot_E', 'guard_orch_action_transitions',
       CASE WHEN p.prosrc LIKE '%OLD.status = ''executed'' AND NEW.status IN (''approved'', ''failed'')%' THEN 'yes' ELSE 'NO: read it before applying' END, NULL
FROM pg_proc p WHERE p.oid = 'public.guard_orch_action_transitions()'::regprocedure
UNION ALL
SELECT 'trigger', c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid),
       '03_verify.sql inserts and updates throwaway rows inside a rolled-back block: read each trigger for side effects outside the database first'
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE t.tgrelid IN ('public.orch_actions'::regclass, 'public.orch_runs'::regclass) AND NOT t.tgisinternal
UNION ALL
SELECT 'action_status_counts', status::text, count(*)::text, NULL FROM public.orch_actions GROUP BY status
UNION ALL
SELECT 'run_status_counts', status::text, count(*)::text, NULL FROM public.orch_runs GROUP BY status
UNION ALL
SELECT 'not_confirmed_stored_as_failed', 'orch_actions', count(*)::text, 'failed rows whose result says outcome=unknown (left as they are)'
FROM public.orch_actions WHERE status = 'failed' AND result ->> 'outcome' = 'unknown'
ORDER BY 1, 2, 4;
