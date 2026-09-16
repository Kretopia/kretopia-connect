# Hire Notification Fix — Verification

Fix for the root cause documented in [HIRE_LOOP_AUDIT.md](HIRE_LOOP_AUDIT.md):
a March 2026 RLS fix on `notifications` (correctly closing a spoofing hole)
silently broke every client-side, cross-user notification insert, including
the applicant-hired and recruiter-new-applicant paths.

## What changed

- `supabase/migrations/20260823150000_hire_loop_notification_fix.sql` —
  three `SECURITY DEFINER` RPCs (`accept_application`,
  `notify_application_status`, `notify_new_application`), each validating
  the caller's relationship to the target user itself before writing a
  notification, mirroring the existing `vouch_on_credit` pattern. Adds a
  `dedupe_key` column + partial unique index on `notifications`, and a
  `source_application_id` column + partial unique index on `projects` so a
  retried/duplicated `accept_application` call is a no-op on the second
  attempt (idempotent — no second Studio, no second notification).
- `src/pages/OpportunityDashboard.tsx` — `updateApplicationStatus` now
  calls `accept_application` (accept path) or `notify_application_status`
  (shortlist/reject path) instead of writing `projects`/
  `project_collaborators`/`notifications` directly from the client. Added
  an in-flight guard (`processingApplicationIds`) as defense-in-depth
  against a double-click firing the RPC twice.
- `src/components/ApplyToOpportunityDialog.tsx` — calls the new
  `notify_new_application` RPC after a successful application insert (the
  reverse-direction instance of the same bug).
- `src/lib/pushNotifications.ts` — `sendPushNotification` no longer
  silently reports `success: true` when the in-app insert fails; email
  dispatch call sites' bare `.catch(() => {})` now log the error. Both
  `notifyApplicantStatusChange` and `notifyOpportunity` now pass
  `skipInApp: true` where a call site's in-app leg is already covered by
  one of the new RPCs, avoiding a redundant (and now-loud) failed insert.
- `src/integrations/supabase/types.ts` — manually added the three new RPC
  signatures. This file is normally regenerated from the live database
  schema (`supabase gen types`); since the migration above has not been
  applied anywhere yet (see Status), there is nothing to regenerate from.
  These entries were hand-written to match the migration exactly and
  should be replaced by a real `supabase gen types` run once the migration
  is applied, to catch any drift.

## Status

| Item | Status |
|---|---|
| Migration written | Implemented |
| Migration applied to any database | **Not done** — no Supabase DB access in this session (MCP unauthenticated); per the task's own deployment rules, a production migration is prepared, not auto-applied, and needs a human with database access to run it |
| `tsc --noEmit` | **Passing** — clean except the pre-existing, unrelated `StudioAICreate.tsx` baseline error |
| `npm run test` | **Passing** — 74/74 (no payment/hire-specific tests exist in the suite; this only confirms no regression in existing coverage) |
| RPC behavior against a real database (the 6 automated scenarios listed in `HIRE_LOOP_AUDIT.md` §10, and the 4 manual scenarios) | **Not tested** — requires the migration to be applied to a real (ideally non-production) Supabase instance first. Blocked on the same missing DB access as above. |
| Browser-tested end-to-end (apply → message → interview → accept → notification → Studio) | **Not tested** — requires two real authenticated test accounts and an applied migration; not performed this session |

## What is and isn't proven right now

**Proven**: the code compiles, the RPC bodies were written by directly
reading and matching this repo's actual schema (`applications`,
`opportunities`, `projects`, `project_collaborators`, `notifications`
columns and existing RLS policies, cited in the migration's comments) and
its own established `SECURITY DEFINER` pattern (`vouch_on_credit`,
`notify_collaborators_on_credit` in `20260424235925_...sql`). The
authorization check in each RPC (`auth.uid() = opportunity.created_by` /
`auth.uid() = application.applicant_id`) mirrors the existing RLS policies
on `applications` exactly, so it shouldn't authorize anything the old RLS
policies didn't already intend to allow.

**Not proven**: that the SQL actually executes correctly against a live
Postgres instance — no local or hosted Supabase database was available to
apply the migration and run it in this session. Before this is considered
production-ready, someone with database access needs to:

1. Apply the migration to a non-production (or carefully-supervised
   production) Supabase environment.
2. Run `supabase gen types` and diff it against the hand-written entries in
   `types.ts` added by this change — confirm they match.
3. Run through the manual verification checklist in `HIRE_LOOP_AUDIT.md`
   §10 with two real test accounts.
4. Ideally add the automated RPC tests described in the same section — no
   test harness for Supabase RPCs (pgTAP or equivalent) currently exists in
   this repo, so this would be new test infrastructure, not just new test
   cases.

## Known follow-up not included in this fix

- `sendPushNotification` is also used by `notifyMatch` and `notifyMessage`
  (match/message notifications), which are cross-user in the same way and
  likely hit the identical RLS rejection today. This fix only routes the
  hire-loop paths through validated RPCs; those two call sites still use
  the direct client insert and are still probably silently failing their
  in-app leg. Out of scope for "Hire Loop" but worth the same treatment.
- `public.applications.status` has no `CHECK` constraint and its UPDATE RLS
  policy has no `WITH CHECK`, so the opportunity owner can set `status` to
  any string, and `CompanyHiringDashboard.tsx:130` checks for a `'hired'`
  value nothing else writes — a latent drift bug noted by the audit,
  unrelated to the notification fix, not addressed here.
