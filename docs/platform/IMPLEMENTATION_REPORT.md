# Implementation report

Branch `chore/platform-baseline`, from `main` @ `6693b982d`, 2026-10-19. Nothing is deployed, no migration is run, no secret is touched.

## Files created
- `.github/workflows/ci.yml`: typecheck, lint (advisory), test, build on PRs and pushes to `main`.
- `.github/workflows/deploy-edge-functions.yml`: manual, environment `production`, Supabase CLI, functions only.
- `docs/platform/`: `REPO_AUDIT.md`, `CI_POLICY.md`, `DEPLOYMENT_RUNBOOK.md`, `RELIABILITY_RULES.md`, `AUDIT_TRAIL_DESIGN.md`, `BACKUP_RECOVERY.md`, `INCIDENT_RUNBOOK.md`, `IMPLEMENTATION_REPORT.md`.
- `docs/observability/`: `SENTRY_PLAN.md`, `GRAFANA_SUPABASE_PLAN.md`, `UPTIME_PLAN.md`.
- `docs/security/`: `SECURITY_BASELINE.md`, `RLS_TEST_PLAN.md`.
- `docs/product/`: `MATCHING_ARCHITECTURE.md`, `OPPORTUNITY_RANKING.md`.
- `docs/analytics/KRETOPIA_LOOP_METRICS.md`.
- `src/lib/__tests__/edge/failureContract.test.ts`: 8 tests for the fixes below.

## Files modified (error handling, smallest diffs)
`speed-session-reminders`, `speed-session-autocancel`, `speed-session-recap` (failed work no longer reported as success; 5xx when every unit failed), `generate-match-explanation` (session required; no invented score; 502), `generate-ice-breakers` (session required; no error echo), `send-credit-invite` (unsaved token is an error; per-invite `email_sent`), `src/lib/__tests__/edge/memoryDb.ts` (`gte`, `lte`).
The recording pipeline was fixed earlier in PR #225 and is not repeated here.

## Not touched
Payments, Stripe, Daily keys, Twilio, Gmail, OAuth, secrets, UI, copy, branding, migrations, RLS, lockfiles, `package.json`, `supabase/config.toml`, any database row.

## Verified
`npm run typecheck` 0 errors. Full test run with the 7 known-broken files excluded (as `ci.yml` does): 187 files, 1,853 tests pass. New edge tests: 8 pass, 3 mutation checks fail as expected. Workflows were not executed locally; the first run is this PR.

## Risks remaining
1. ~~P0 project takeover~~ closed 2026-10-19 (M0a applied, PR #227). Remaining on that table: members can still edit other `projects` columns (M1).
2. **P1** `database_export_*` buckets (`call_transcripts` client UPDATE removed 2026-10-20); `computeOpportunityMatch` vanity badge.
3. Edge code in `main` is not what runs in production until pasted or deployed (PR #225 functions included). CLI deploys reset JWT flags.
4. The cron jobs exist only in the production database.
5. Lint and 7 test files are red on `main` (listed in `CI_POLICY.md`); both lockfiles are unusable outside Lovable.
6. The CLI token may lack access to the production project (403 seen before).

## GitHub secrets required (names only)
Environment `production`: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`. Optional later: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Lovable environment: `VITE_SENTRY_DSN`.

## Manual setup
1. Merge this PR; confirm `CI / verify` is green on it.
2. Branch protection on `main` as in `CI_POLICY.md` (decide the Lovable bot bypass first).
3. Create the `production` environment with reviewers and the two secrets.
4. Paste or deploy the PR #225 functions in the order listed in that PR; Publish the frontend.
5. Create the monitors in `UPTIME_PLAN.md`; enable `VITE_SENTRY_DSN`.

## DRAFT migrations
None written here. M0a, drafted earlier in `docs/roadmap/schema-impact-report.md`, was approved and applied to production on 2026-10-19 and is recorded in PR #227. Other changes are described in prose in `SECURITY_BASELINE.md`.

## Next 7 days
Day 1: confirm backup plan and PITR (M0a is done). Day 2: deploy the SSRF fix (done in code). Day 3: inspect and move `database_export_*`; make `feedback-screenshots` private. Day 4: Sentry masking PR and DSN. Day 5: uptime monitors and Grafana alerts for webhooks and stalled recordings. Day 6: restore rehearsal on a scratch project. Day 7: fix the 7 excluded tests and the lockfile; remove `continue-on-error` from lint.
