# Edge function deployment runbook

Scope: Edge Functions only. No migrations, no frontend, no secrets. Workflow: `.github/workflows/deploy-edge-functions.yml` (manual, environment `production`).

## One-time setup
1. GitHub > Settings > Environments > `production`: add required reviewers and restrict to `main`.
2. Environment secrets (names only): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`.
3. `SUPABASE_PROJECT_ID` must be the production project ref. Production is the legacy backend, not the `project_id` in `supabase/config.toml` (that is the unused Cloud backend).
4. TODO: confirm the token's account is a member of the production project (the CLI got 403 on that ref before); until then deploys stay manual pastes into the Lovable "kretopia-app" editor.

## Deploy
1. Merge to `main` through a green CI. Note the commit SHA.
2. Tag it: `git tag edge-<YYYYMMDD>-<n> <sha> && git push origin edge-<YYYYMMDD>-<n>`.
3. Actions > Deploy Edge Functions > Run workflow on `main`:
   - `functions`: folder names, e.g. `daily-recording-webhook transcribe-call`.
   - Redeploy every function that imports a changed `_shared` file (the CLI bundles `_shared` into each function).
   - `verify_jwt`: leave on. Run a second time with it off only for webhook and cron endpoints that must accept non-user callers (`daily-recording-webhook`, `stripe-*-webhook`, `guest-wallet-webhook`, `telegram-webhook`, `handle-email-suppression`, `integration-oauth-callback`, `transcribe-call`). The CLI resets this flag on every deploy: read the current value in the dashboard first and keep it unchanged.
4. Approve the run in the `production` environment.

## Verify (each function, within 10 minutes)
- Boot: `curl -i -X OPTIONS https://<project>.supabase.co/functions/v1/<fn>` returns 200.
- Auth: `curl -i -X POST -d '{}' .../<fn>` returns the function's own JSON 401/400. A platform 404 means it did not deploy; a 500 means it did not boot.
- Never POST-probe cron, webhook, payment or moderation functions. Use the provider's test event instead (Daily and Stripe dashboards).
- Dashboard > Edge Functions > Logs: no new `error` lines for 10 minutes; invocations show 2xx for the normal path.
- Recording path: `daily-recording-webhook` test event returns 200 `{"ok":true}`.

## Rollback (target: under 10 minutes)
1. Pick the previous tag: `git tag --list 'edge-*' --sort=-creatordate | head`.
2. Actions > Run workflow, choose that tag in "Use workflow from", same `functions` and `verify_jwt`.
3. Re-run the Verify steps. Record the incident in `INCIDENT_RUNBOOK.md` terms.
4. If a function wrote bad rows, stop and follow `BACKUP_RECOVERY.md`; do not hand-edit production data.

## Never from this workflow
Migrations, `supabase db push`, secret changes, frontend Publish (Lovable), cron changes.
