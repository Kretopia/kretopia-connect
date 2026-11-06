# Edge function deployment runbook

Scope: Edge Functions only. No migrations, no frontend, no secrets. Workflow: `.github/workflows/deploy-edge-functions.yml` (manual, environment `production`).

## Where things live (checked 2026-11-03)

Two things are called `kretopia-app`, and only one of them is a place you can paste into. Read this before following any "kretopia-app" instruction.

| What | Where it is | What changes it |
|---|---|---|
| The code, and every pull request | GitHub **`Kretopia/kretopia-connect`**: public, default branch `main`, not archived. Pass `--repo Kretopia/kretopia-connect` to `gh` (or run `gh repo set-default Kretopia/kretopia-connect` once per clone) | a merged pull request |
| Kretopia Connect's own Cloud backend (`project_id` in `supabase/config.toml`: `czpucbhnmcudggydwxlg`) | this repository's `supabase/` folder | Lovable, when the pull request is merged (per `LOT4_PASTE_KIT.md`; not re-checked) |
| **Production's legacy backend** (database `kwmcocsitwssrtzkdojh` and the edge functions that run on it) | the **Lovable project `kretopia-app`**: an editor project, not a GitHub repository. No GitHub repository that I can see is connected to it | a person pasting code or SQL into that project. Merging to `main` deploys nothing there, and `deploy-edge-functions.yml` is manual (`workflow_dispatch`) and stays blocked by the 403 in step 4 below |
| The GitHub repository `Kretopia/kretopia-app` | **archived and read-only** (last push 2026-09-20). Not a deploy source, not a pull-request target, not a paste target | nothing: it cannot be pushed to |

What this means in practice: production's code is a hand-pasted copy that can drift from `main` (see "Pending pastes" below for the last comparison),
and `main` is only the source of truth for what Kretopia Connect itself runs. Checked read-only on 2026-11-03: `main` has **no branch protection
and no ruleset**; of the four workflows in `.github/workflows/`, `ci.yml` runs typecheck, lint, tests and build on pull requests and on pushes
to `main`, and the other three are manual (`workflow_dispatch`), so nothing deploys because of a push.

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

## Pending pastes into the Lovable project `kretopia-app` (checked 2026-10-20)
Production edge functions run the copy in `kretopia-app`, not `main`. On 2026-10-20 that project was compared with `main` file by file (read-only). Paste **shared files first, then the function**: a function whose import is missing does not start, and every call to it fails.

Already in `kretopia-app` and compatible, nothing to paste: `_shared/projectAccess.ts` (same exports), `_shared/aiModels.ts`, `_shared/embed.ts`.

1. **PR #228, SSRF guard** (security, smallest): overwrite `_shared/ssrf.ts` (the copy there is the older one without the IPv6-mapped hex fix), then `fetch-og-data`, `fetch-portfolio-data`, `fetch-youtube-playlist` (`index.ts` each). Verify: an ordinary public page still loads in a link preview.
2. **PR #237, invitation secret (M7)**: new `_shared/inviteSecret.ts`, `_shared/outboundText.ts`, `_shared/outboundBudget.ts`, then `send-project-invitation/index.ts`. The copy of this function in `kretopia-app` is far older than `main`, so the paste also turns on what `main` already had: a send budget (20 invitations per inviter per hour, 3 per address per hour, recorded in `email_send_log`, table and columns checked in production), inviters limited to owner, collaborator, creative and client (not guests), cleaned recipient addresses, and the sender changes from `info@kretopia.com` to `noreply@kretopia.com` (same domain). Frontend is already published. Verify: invite a test address, the email arrives, its sign-in link opens the Studio, an `email_send_log` row with template `project-invitation-direct` appears.
3. **PR #225, recordings**: new `_shared/findCallByRoom.ts`, `recordingRow.ts`, `recordingTranscript.ts`, `webhookFreshness.ts`, `recordingAccess.ts`, `meetingParticipantAccess.ts`, then `daily-recording-webhook`, `sync-daily-recordings`, `transcribe-call`, `get-recording-link` (`index.ts` each). `_shared/recordingRow.ts` also handles the unique index on `recording_id` that is already applied in production (M8). Production `get-recording-link` is an older, weaker copy. Verify with the recording path check above.

None of these needs a migration or a secret. After each paste, watch the function's logs for 10 minutes (Verify section).

**Decision 2026-10-20 (taken on the owner's delegation): paste all three, in this order, shared files first.** #228 is a security fix with no behaviour change, so it goes first. #237 is next: the sender address change from `info@kretopia.com` to `noreply@kretopia.com` is accepted (same domain, so deliverability is unchanged; invitations are system mail), and so are the send budget and the role limit, which `main` already had. #225 last, because it is the largest set. Skip nothing: until they are pasted, production runs the older code. Claude cannot paste: the only write path to `kretopia-app` is the Lovable chat, which is off limits, so this stays a manual step. After each paste, tell Claude and it will re-read the project's files (read-only) to confirm the shared files and the function are there, and check production for the new behaviour.

## Pending pastes from the 2026-11-06 session (PR `Kretopia/kretopia-connect#318`, branch `claude/pensive-tesla-o6ed14`)
Nothing below is applied or pasted. The client changes in the pull request ship with the app; the SQL and the edge functions only reach production when a person pastes them into `kretopia-app`.

**SQL, in this order, before the pull request is published** (each file has its own preflight query and rollback in its header; run `docs/security/VERIFY_PENDING_MIGRATIONS_20261106.sql` afterwards):
1. `supabase/migrations/20261106100000_cosign_recipient_authority.sql`: only the member a Co-Sign request was sent to can answer it. Until it is applied, a third account holding the link can still answer a request sent to someone else. The app tolerates the old function in the meantime.
2. `supabase/migrations/20261106120000_featured_in_confirmation_and_role_claim_requests.sql`: "Featured In" shows only what its owner confirmed (every member starts from zero and re-confirms), and a role claim becomes a request that an admin decides. Two things to know before applying it: the public "Featured In" list is empty for everyone until members confirm, and requests are decided in the app, in **Admin > Users & Trust > Role claims** (it says plainly if this migration is not applied yet); calling `decide_icdb_role_claim(request_id, true|false, note)` from the SQL editor remains the fallback. Until it is applied, the new client hides "Featured In" from visitors (it fails closed), "This is me" cannot save, and "Claim" still creates the credit at once although the screen says a reviewer checks it.

**Edge functions, shared files first** (no secret and no migration needed):
3. New `_shared/pressCandidate.ts`, then `enrich-creator-profile/index.ts`: a press page found by searching a name is offered only when it also matches the member's role, a project, a co-signer, their site or their city, and it is saved unconfirmed.
4. `analyze-profile-url/index.ts` and `import-profile-url/index.ts`: the page text is treated as data, not as instructions. No shared file.
5. Not checked: whether `send-push-notification` and `_shared/webPush.ts`, `_shared/pushEndpoint.ts` (pull request #316) were ever pasted. Compare the copy in `kretopia-app` with `main` before any push test (see `docs/release/PUSH_DEVICE_PROOF.md`, step 0).
