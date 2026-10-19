# Grafana and Supabase plan

Goal: see Edge Function failures, the recording pipeline, webhooks, crons, and database health in one place, with alerts. Nothing here is installed or created by this change.

## Data sources
1. Supabase logs (function invocations, status codes, errors): Logs Explorer, or a log drain to Grafana Loki.
2. Supabase Metrics API (Prometheus format) scraped by Grafana Cloud: database connections, CPU, memory, disk.
3. A read-only Postgres connection for the SQL panels below. It needs a dedicated read-only role: creating it is a migration and needs approval (not drafted here).
Access note: production is the legacy project; confirm the monitoring account is a member of it before starting.

## Dashboards and panels
- **Edge Functions**: invocations, 5xx ratio and p95 latency per function; top 10 failing functions.
- **Recording pipeline** (`call_transcripts`):
  - rows by `status` per hour;
  - stalled: `status in ('pending','transcribing') and created_at < now() - interval '30 minutes'`;
  - skipped: `status = 'failed' and error like 'transcript_skipped:%'`;
  - real failures: `status = 'failed' and error not like 'transcript_skipped:%'`.
- **Webhooks**: Stripe events per day (`stripe_webhook_events`), `daily-recording-webhook` 2xx/4xx/5xx counts, `handle-email-suppression` 401 count.
- **Crons**: latest run per job from `cron.job_run_details` (`status`, `start_time`, `end_time`); never select `cron.job.command` (it embeds secrets).
- **Database**: connections vs pool, slow queries (`pg_stat_statements` if enabled), size of `analytics_events` (1.4 M rows) and `client_error_logs`.

## Alerts
| Alert | Condition | For | Severity |
|---|---|---|---|
| Function errors | 5xx ratio > 5% on any function | 5 min | SEV3 |
| Function down | 5xx ratio > 20% | 5 min | SEV2 |
| Webhook failing | >= 3 5xx on a webhook function | 10 min | SEV2 |
| Stripe silence | no `stripe_webhook_events` row while payments are live | 24 h | SEV3 |
| Recording stalled | stalled count > 0 | 30 min | SEV3 |
| Recording failures | real failures > 3 | 1 h | SEV3 |
| Cron failed | latest run `status = 'failed'` twice in a row, or no run for 3x its period | n/a | SEV3 |
| DB connections | > 80% of pool | 10 min | SEV2 |
| Disk | > 80% | 1 h | SEV2 |
| Table growth | `analytics_events` > +500 k rows/day | 1 day | SEV4 |

## Secrets (names only)
`SUPABASE_PROJECT_REF`, `SUPABASE_METRICS_TOKEN`, `GRAFANA_CLOUD_API_KEY`, `GRAFANA_PG_READONLY_URL`, `SLACK_ALERTS_WEBHOOK_URL`.

## Setup
1. Grafana Cloud stack; add the Prometheus scrape job for the Metrics API; add Postgres and Loki data sources.
2. Import the panels above as one folder "Kretopia / Production".
3. Create the alert rules; route SEV2 to the on-call phone, SEV3 and SEV4 to Slack.
4. Run each alert once with a synthetic condition (for example lower a threshold) and confirm delivery.
5. Review the dashboards in the weekly ops check (`INCIDENT_RUNBOOK.md`).

## Rollback
Disable the alert rules, then the scrape job. No application code or database object is involved.
