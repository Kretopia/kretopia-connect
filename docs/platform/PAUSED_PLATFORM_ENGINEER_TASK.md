# Platform engineer task (paused 2026-10-21, resumed the same day: M11 applied)

> **Update 2026-10-21:** the owner said "apply M11" and it was applied to production (migration `20261021100000`, report M11, verified with rolled-back tests). The notes below are kept as they were at the pause; everything under "Resume instruction" is done, and what remains is the pending pastes, the backup check and the open items.

Paused on 2026-10-21 by the owner, who asked for a product-corrective task first (`docs/product/PRODUCT_CORRECTIONS_REPORT.md`). Nothing below has been resumed or changed since the pause.

## Resume instruction
Say **"apply M11"**. Claude then applies the owner-or-client guard on `projects` (report M11 in `docs/roadmap/schema-impact-report.md`) the same way as M6: write the migration file, apply it to production, run rolled-back tests as a guest, a member, the owner, the client and the service role, check that completing a project through the last milestone payment still works for the client, then open the PR that records it. M11 is **not applied**; no rolled-back test for it has been run.

## Where the platform brief stands (all merged on `main`, nothing open)
Applied to production, each with a migration file and a report section in `docs/roadmap/schema-impact-report.md`:
- M0a project `created_by` guard; M5 no client UPDATE on `call_transcripts`; M6 owner-only payer and agent columns on `projects`; M7 (database part) invitation preview token secret, 14-day expiry, revoke on accept or withdraw; M8 unique index on `call_transcripts.recording_id`; M9 `feedback-screenshots` private, 5 MB, images only; M10 steps 1 and 2: pg_cron run history cut to 14 days (database 2.8 GB to 1.2 GB) and the daily job `prune-cron-run-details`.

Built in code and merged: Sentry Replay masking (#230), SSRF guard (#228, code only), Studio Calls audit fixes (#229), invitation secret in the app (#237, code only), analytics throttle (#245, published).

Decided, not applied: M10 step 5 skipped by the owner, step 4 not built; `database_export_*` buckets kept until backups and PITR are confirmed and a restore is rehearsed; M11.

## Pending, not mine to do
- **Edge function pastes into the Lovable project `kretopia-app`**, in this order, shared files first: #228 (overwrite `_shared/ssrf.ts`, then `fetch-og-data`, `fetch-portfolio-data`, `fetch-youtube-playlist`), #237 (`_shared/inviteSecret.ts`, `outboundText.ts`, `outboundBudget.ts`, then `send-project-invitation`), #225 (six `_shared` files, then four recording functions). Exact list: `docs/platform/DEPLOYMENT_RUNBOOK.md`. As of 2026-10-20, none was pasted (`_shared/inviteSecret.ts` still missing there).
- Confirm backups and PITR in the Supabase dashboard (`BACKUP_RECOVERY.md`, gaps 1 and 5).

## Open items that were never started
Revoking default table privileges (decided not worth it), the "match" badge offset in `computeOpportunityMatch` (UI change, excluded by the platform brief), Sentry plan items 2 to 5, RLS test harness, the rest of `docs/platform/IMPLEMENTATION_REPORT.md`.

## Open pull requests at the pause
None. Last merged: #246 (decisions and report M11).

## Standing rules to keep
No migration without a written report and an explicit "apply"; no deploy; never call the Lovable connector's `send_message`; never read `cron.job.command`; keep proposals free of runnable SQL; do not stage `ROADMAP.md` or `supabase/functions/mcp/index.ts`; do not rewrite pushed history; commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Modified files at the pause
None pending. The working tree has only the owner's own `ROADMAP.md` change, which is never staged.
