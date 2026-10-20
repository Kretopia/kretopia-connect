# Backup and recovery

Production is the legacy Supabase project. Facts marked "confirm" are not readable from the repo or from SQL and must be checked in the dashboard.

## What must be recoverable
| Asset | Where it lives | Backed up by |
|---|---|---|
| Database (about 370 tables, `auth.users`) | Supabase Postgres | Supabase daily backup; point-in-time recovery only if the add-on is on (confirm) |
| Storage objects | Supabase Storage (24 buckets) | **Not part of a database backup** |
| Call recordings | Daily storage | Daily; retention placeholder 90 days |
| Code | GitHub `Kretopia/kretopia-connect` | GitHub; Lovable syncs from `main` |
| Edge Function code | Repo, plus the deployed copy | Repo is the source; tag every deploy (`DEPLOYMENT_RUNBOOK.md`) |
| Cron jobs (21) | Only in the production database | Database backup; **not reproducible from the repo** |
| Secrets | Supabase and Lovable secret stores | Names inventoried in `SECURITY_BASELINE.md`; values in a password manager |

## Targets
- RPO: 24 h with daily backups; 15 min if point-in-time recovery is enabled (recommended).
- RTO: database 4 h; Edge Functions and frontend 1 h (redeploy from tag or revert).

## Gaps (fix in this order)
1. Confirm the plan, backup schedule, and PITR in the dashboard; record it here.
2. Storage has no scheduled copy. Add a nightly copy of the private buckets that hold user work (`project-files`, `message-attachments`, `payment-proofs`, `dispute-evidence`, `deal-memos`, `product-files`) to a second provider.
3. Export cron job names and schedules into the repo (never the command: it embeds secrets).
4. Two private buckets named `database_export_*` hold ad-hoc dumps (13 Jul 2026, 62 MB; 28 Sep 2026, 96 MB; one object each, no client policy can read them). Decide who owns them; move them offline, then delete them from the project.
5. No restore has ever been rehearsed.

## Restore procedure (database)
1. Declare SEV1 (`INCIDENT_RUNBOOK.md`). Stop writers: pause the 21 crons; set the app to read-only or maintenance if available.
2. Restore the backup or the chosen point in time into a **new** project. Never restore over production first.
3. Verify on the copy: row counts of `profiles`, `projects`, `credits`, `call_transcripts`, `milestones`; 0 public tables without RLS; policy count equals production's last known count; `auth.users` matches `profiles`.
4. Re-create what a backup does not carry: cron jobs (from the export in gap 3), function secrets, storage objects, Edge Functions (redeploy from the latest tag, JWT flags set explicitly).
5. Cut over: change `VITE_SUPABASE_URL` and the publishable key in the Lovable environment, publish; re-point the Stripe, Daily, and Telegram webhooks to the new URL and secrets.
6. Reconcile the gap: replay Stripe events from the dashboard for the lost window; run `sync-daily-recordings` for recordings; re-send missed transactional emails only with their idempotency keys.
7. Keep the old project, read-only, for 14 days.

## Rehearsal
Quarterly, on a scratch project: restore the latest backup, run step 3, and time it. Record RPO/RTO achieved. The first rehearsal is the most valuable action in this file.

## Rollback
This procedure only creates a new project. If the copy fails verification, nothing has changed in production.
