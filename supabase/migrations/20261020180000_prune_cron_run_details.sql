-- M10 steps 1 and 2 (docs/roadmap/schema-impact-report.md): cron.job_run_details had no retention and had grown to
-- 1.66 GB (1.64 million rows, 1.37 million from one job that no longer exists). A daily job now deletes run history
-- older than 14 days. The history that existed was cleaned and the disk reclaimed by hand on 2026-10-20 (a table
-- rewrite, see the report); that one-off is not part of this migration.
-- cron.schedule with an existing name replaces that job, so this is safe to run again.
-- Applied to production on 2026-10-20 with approval; this file records it so the migrations match.
-- Rollback: SELECT cron.unschedule('prune-cron-run-details');

SELECT cron.schedule(
  'prune-cron-run-details',
  '17 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '14 days'$$
);
