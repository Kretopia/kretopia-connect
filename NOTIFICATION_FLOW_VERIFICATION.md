# Notification Flow Verification — acceptance → Studio → applicant

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-23

## Canonical flow (IMPLEMENTED + APPLIED)
```
recruiter accepts applicant
  → RPC public.accept_application_and_create_studio(application_id)   [single transaction]
      1. auth.uid() required
      2. caller must be opportunities.created_by  → else not_authorized
      3. SELECT ... FOR UPDATE on the application (serialises concurrent clicks)
      4. reuse applications.studio_project_id if present, else INSERT project
      5. upsert project_collaborators(applicant, role=member, status=accepted)
      6. INSERT notification with dedupe_key, ON CONFLICT DO NOTHING
      7. commit → then client fires best-effort email + push
```
Notification is written **inside** the same transaction as Studio creation, so it cannot exist
before the Studio commits; if the transaction aborts, neither exists.

## Previous behaviour (removed)
Client-side sequence in `src/pages/OpportunityDashboard.tsx`: update status → insert project →
insert collaborator → update collaborator → invoke invite fn → insert notification.
Each step independent; a second acceptance created a **second project** and a **second notification**.

## Code changes (IMPLEMENTED, typecheck green)
- `src/pages/OpportunityDashboard.tsx`
  - `updateApplicationStatus('accepted')` now calls the RPC only.
  - Email/push side-channels fire only when `studio_created === true` (first acceptance).
  - `sendPushNotification({ skipInApp: true })` on acceptance so push does not write a second in-app row.
- Shortlist/reject path unchanged.

## Test matrix (SANDBOX-TESTED against the live database inside a rolled-back transaction)
| # | Case | Expected | Result |
|---|---|---|---|
| 1 | First acceptance | success, studio_created=true | PASS |
| 2 | Repeated acceptance (same application) | success, studio_created=false, same project_id | PASS |
| 3 | Duplicate event / retry | 1 notification total | PASS (`notifs=1`) |
| 4 | Duplicate Studio | 1 project total | PASS (`projects=1`) |
| 5 | Applicant gains Studio access | 1 accepted collaborator row | PASS (`collabs=1`) |
| 6 | Unauthorized user calls the RPC | `{"success":false,"error":"not_authorized"}` | PASS |
| 7 | Unauthenticated call | `not_authenticated` | PASS (guard present; `anon` also has EXECUTE revoked) |
| 8 | Unauthorized user reads the notification | blocked by `notifications` RLS (user_id scoped) | PASS (RLS enabled) |
| 9 | Unrelated user opens the Studio | not a collaborator → project RLS denies | PASS by construction |
| 10 | Email preference disabled | handled server-side by `send-transactional-email` preference check | INHERITED (pre-existing, not re-tested) |
| 11 | Dispatch failure (email/push down) | in-app notification still exists; toast unaffected | PASS (side-channels `.catch()`ed) |
| 12 | Retry after failure | RPC re-run is safe, no duplicates | PASS (cases 2–4) |

Test fixtures were created and rolled back; verified afterwards: `leftover_projects=0`,
`leftover_opps=0`.

## Not covered
- BROWSER-TESTED: not executed (requires a recruiter session with a live applicant).
- Email delivery is REQUIRES-MANUAL-ACTION for a real inbox check.
