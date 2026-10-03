# Exact-version approval: MVP (Gate 2, display only)

> **DO NOT USE THIS AS LEGAL OR CONTRACTUAL APPROVAL YET.** It is a read-only display rule over existing fields. Nothing here binds an approval to a stored version or content hash, and none of it is enforced by the database.

## What is implemented

In the deliverable dialog (`DeliverablesBoard.tsx`), next to the status badge, collaborators now see what an "Approved" status actually covers. The rule lives in `src/lib/approvalValidity.ts`.

- **Valid:** "Approved <date> — covers the N files uploaded up to then."
- **No longer applies:** if any submitted file has an `uploaded_at` later than the review's `reviewed_at`, the dialog says "Approval no longer applies (new version uploaded). Last approved <date>." A tooltip gives the count of newer files.
- **Unknown:** if the deliverable is "approved" but has no `reviewed_at` (for example approved through a share link, which writes no review time), the dialog says the approval can't be matched to the current files.

The stored `status` is never changed by this rule. It only changes what the UI claims. The board query now also selects `reviewed_at` (an existing column).

## Why "version" is a time comparison

No version exists to compare. `project_deliverables.version` is always 1, and `deliverable_versions` has no writer in the repo. So "the version that was approved" is approximated as "the files uploaded before `reviewed_at`".

## What is still missing

- **Schema:** a stored version or content hash per approval (`version_id` on the approval, `approved_version_id` on the deliverable) and a writer for `deliverable_versions`. Proposed as M2 in `schema-impact-report.md`; not applied.
- **RLS / enforcement:** any member can still update `status`, `file_url` and `submission_files`. Share-link approvals (`share_link_approvals`) accept unauthenticated inserts. An approved card can still be dragged or edited without a reset (only upload and file removal reset it).
- **Re-approval:** a stale approval keeps `status = approved`, and the Approve button appears only for `submitted`. Re-approving currently means moving the card.
- **Clock and data limits:** timestamps come from each user's device clock, so skew can flip the result. Files with no `uploaded_at` cannot be placed in time and are not counted as newer. Replaced or removed files are not detected by this rule (removal already resets approval).
- **Cards and share links:** the note appears only in the dialog; board cards and the guest review page do not show it.
- **Tests:** no two-party or permission-bound test covers this. The rule has only been checked with a throwaway unit test.
