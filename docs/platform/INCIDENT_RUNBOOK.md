# Incident runbook

## Severity
| Level | Meaning | Examples | Response |
|---|---|---|---|
| SEV1 | Data loss or exposure, payments wrong, site down | project takeover exploited, leaked service-role key, wallet balances wrong, site down | page now; all hands; status note within 30 min |
| SEV2 | A core flow is broken for many users | sign-in, calls, recording, checkout failing; a webhook returning 5xx | page now; fix or roll back within 1 h |
| SEV3 | A feature is degraded, a workaround exists | recaps delayed, one cron failing, emails late | next business hour |
| SEV4 | Cosmetic or single-user | typo, one user's profile | backlog |

## First 15 minutes
1. **Acknowledge** and name an incident lead. One person decides; others report.
2. **Scope**: who, since when, which flow. Check Sentry (new issues), function logs (5xx per function), the uptime monitors, `client_error_logs`.
3. **Stop the bleeding before diagnosing**: roll back the last change (below); pause the affected cron; disable the affected entry point.
4. **Protect data**: if exposure is possible, treat as SEV1, rotate the secret involved (`SECURITY_BASELINE.md` section 5), and stop.
5. **Communicate**: one line to the team channel (what, impact, owner, next update time). Update every 30 minutes.

## Rollback
- Frontend: revert the merge commit in a new PR, merge, Publish in Lovable. Check `/version.json` changed.
- Edge Functions: redeploy the previous tag with the deploy workflow (`DEPLOYMENT_RUNBOOK.md`). Check JWT flags.
- Database: never revert by hand. Prefer a forward fix; if data is lost, `BACKUP_RECOVERY.md`.
- Webhooks: fix, then replay from the provider dashboard. Do not edit rows to "make it match".

## Playbooks
- **Recordings missing**: Daily dashboard (webhook deliveries 2xx?), function logs for `daily-recording-webhook`, `call_transcripts` for the room; run `sync-daily-recordings` with `room_name`; check stalled rows (`GRAFANA_SUPABASE_PLAN.md`).
- **Webhook 5xx**: read the log line, fix, replay failed events from the provider; for Stripe confirm the ledger row was released.
- **Payments**: stop at the first doubt; do not retry captures by hand; follow the payment owner's checklist.
- **Cron silent**: `cron.job_run_details` for the job; run the function once by hand with the cron secret only if it is idempotent.
- **Leaked secret**: rotate, redeploy, check logs for use since exposure, note it in the review.

## Escalation
Lead (engineering owner) after 15 minutes without a cause; founder after 30 minutes for SEV1 or any data exposure; providers (Supabase, Daily, Stripe, Lovable) after 30 minutes if the fault is theirs, with project ref and timestamps. Legal and affected users for any personal-data exposure.

## After
Within 5 business days: timeline, root cause, what detected it, what would have detected it sooner, three actions with owners. Add a test or an alert for each root cause. Add the lesson to `RELIABILITY_RULES.md` if it is a rule.
