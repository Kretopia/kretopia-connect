# Uptime plan

External probes that need no application change. Vendor-neutral: any monitor that supports HTTP checks, headers, and keyword match (UptimeRobot, Better Stack, Grafana Synthetic Monitoring).

## Probes
| # | Target | Check | Interval | Alert after |
|---|---|---|---|---|
| 1 | `https://www.kretopia.com/` | 200 and body contains `id="root"` | 1 min | 2 failures |
| 2 | `https://www.kretopia.com/version.json` | 200, valid JSON (changes on each publish) | 5 min | 2 failures |
| 3 | `<supabase>/auth/v1/health` | 200 | 1 min | 2 failures |
| 4 | `<supabase>/rest/v1/` with header `apikey: <publishable key>` | 200 | 1 min | 2 failures |
| 5 | `OPTIONS <supabase>/functions/v1/<fn>` | 200 | 5 min | 2 failures |

Probe 5 functions: `daily-recording-webhook`, `get-recording-link`, `sync-daily-recordings`, `create-meeting`, `mint-meeting-token`, `stripe-marketplace-webhook`, `stripe-wallet-webhook`, `send-transactional-email`, `process-email-queue`. `OPTIONS` cannot run the function's logic, so it is safe. Never `POST` to webhook, cron, payment, or moderation functions from a monitor.

## What this cannot see
- Whether a webhook is *processing* events (a 200 on `OPTIONS` says it booted). Use the Grafana alerts in `GRAFANA_SUPABASE_PLAN.md`.
- Whether a cron ran. Same plan (`cron.job_run_details`). Heartbeat URLs per cron would need a code change; not proposed here.
- Provider-side delivery. Once a month: send the Daily dashboard "test" webhook and check for `{"ok":true}`; check the Stripe dashboard for failed deliveries.

## Thresholds
- Availability target: 99.9% monthly for probes 1, 3, 4.
- Page speed: probe 1 total time p95 > 3 s over 15 min is a warning.
- TLS certificate expires in < 14 days, domain in < 30 days: warning.
- Two consecutive failures from two regions: SEV2 for probes 1, 3, 4; SEV3 for probe 5.

## Secrets (names only)
`UPTIME_API_KEY` (monitor provider), `UPTIME_SUPABASE_PUBLISHABLE_KEY` (the public key sent as `apikey`), `SLACK_ALERTS_WEBHOOK_URL`, `PAGER_ROUTING_KEY`.

## Setup
1. Create the monitors above with two regions and a 30 s timeout.
2. Route SEV2 to the on-call phone and SEV3 to Slack.
3. Add a public status page only after a month of clean data.
4. Put the monitor list in the on-call handover.

## Rollback
Pause the monitors. They write nothing to Kretopia.
