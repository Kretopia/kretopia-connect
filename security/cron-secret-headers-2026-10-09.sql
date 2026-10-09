-- Add the shared x-cron-secret header to the cron jobs that call functions now guarded by
-- requireAdminOrCron (security/edge-deploy-guide-2026-10-09.md). RUN THIS BEFORE pasting the guarded
-- functions into kretopia-app, otherwise the first scheduled run after the paste answers 401.
--
-- * Copies the secret that jobs 34/35/37/39/40/203 already send, server-side: it is never selected,
--   returned or logged. Do not paste the edited SQL, or any output of it, back into a chat.
-- * All-or-nothing: any job it cannot rewrite with certainty aborts the whole block (nothing changes).
-- * Harmless before the paste: the current production functions ignore the extra header.
-- Not in this list on purpose: 27 (pure SQL, runs as postgres), 34/35/37/39/40/203 (already send it).

-- STEP 1 (read-only, prints booleans only): which header format each job uses.
SELECT jobid, jobname, active,
       (command ~* 'x-cron-secret')                      AS already_has_secret,
       (command ~* 'headers\s*:?=\s*jsonb_build_object\(') AS header_builder_form,
       (command ~* 'headers\s*:?=\s*''\{')                AS header_json_literal_form
FROM cron.job
WHERE jobid IN (11, 12, 13, 14, 15, 16, 22, 28, 30, 33, 36, 41, 42, 43, 44, 40)
ORDER BY jobid;
-- Every job except 40 must show exactly one of the two *_form columns = true.

-- STEP 2: apply.
DO $$
DECLARE
  v_secret  text;
  j         record;
  v_new     text;
  v_targets bigint[] := ARRAY[11, 12, 13, 14, 15, 16, 22, 28, 30, 33, 36, 41, 42, 43, 44];
  v_count   int := 0;
BEGIN
  SELECT substring(command from 'x-cron-secret[''"]?\s*[:,]\s*[''"]([A-Za-z0-9_-]{32,})[''"]')
    INTO v_secret
  FROM cron.job WHERE jobid = 40;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Could not read the existing secret from job 40 (format changed?); nothing was changed';
  END IF;

  FOR j IN
    SELECT jobid, command FROM cron.job
    WHERE jobid = ANY (v_targets) AND command !~* 'x-cron-secret'
    ORDER BY jobid
  LOOP
    IF j.command ~* 'headers\s*:?=\s*jsonb_build_object\(' THEN
      v_new := regexp_replace(
        j.command,
        '(headers\s*:?=\s*jsonb_build_object\()',
        '\1''x-cron-secret'', ''' || v_secret || ''', ',
        'i');
    ELSIF j.command ~* 'headers\s*:?=\s*''\{' THEN
      v_new := regexp_replace(
        j.command,
        '(headers\s*:?=\s*''\{)',
        '\1"x-cron-secret": "' || v_secret || '", ',
        'i');
    ELSE
      RAISE EXCEPTION 'Job % has a headers format this script does not recognise; add the header by hand. Nothing was changed', j.jobid;
    END IF;

    IF v_new IS NULL OR v_new = j.command THEN
      RAISE EXCEPTION 'Job % was not rewritten; nothing was changed', j.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := j.jobid, command := v_new);
    v_count := v_count + 1;
  END LOOP;

  -- Verify (booleans only) and roll the whole block back if anything is off.
  IF EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobid = ANY (v_targets) AND command !~* 'x-cron-secret'
  ) THEN
    RAISE EXCEPTION 'Verification failed: some jobs still lack the header; nothing was changed';
  END IF;
  RAISE NOTICE 'Added x-cron-secret to % cron job(s)', v_count;
END $$;

-- STEP 3 (read-only): every job above must now say true, and active must be unchanged.
SELECT jobid, jobname, active, (command ~* 'x-cron-secret') AS has_secret
FROM cron.job
WHERE jobid IN (11, 12, 13, 14, 15, 16, 22, 28, 30, 33, 36, 41, 42, 43, 44)
ORDER BY jobid;
