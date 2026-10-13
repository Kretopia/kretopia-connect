# Share-link approval scope: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`, like the meeting slices (see `security-slices-e-to-i-manual-deployment-checklist.md`).

## 1. Threat addressed

`redeem-project-share` is a public function (no JWT) that writes with the service role. It already binds an approval target to the link's **project**. It did not bind it to the link's **scope**:

| Link scope (`project_share_links.scope`) | What the link exposes (`list_share_link_files`) | What an approval could name before this change |
|---|---|---|
| `project` | every file of the project | any file or deliverable of the project (correct) |
| `folder` | files with `folder_id = scope_ref_id` | **any file and any deliverable of the project**, including files outside the folder and deliverables none of the folder's files belongs to |
| `deliverable` | files with `deliverable_id = scope_ref_id` | the deliverable itself (checked), but **any file of the project** |

`can_approve` defaults to `true`, so a folder link created to show one folder could flip the status of an unrelated deliverable to `approved` or `revision_requested`, and record an approval row against an unrelated file.

Related findings: GA AUX-03 (membership conflated with decision authority), GA PROD-04 (scope and exact approval not established), matrix rows 4 and 10. This is a repository finding (code evidence); it was not reproduced against production.

## 2. Affected actor, object, action

- **Actor:** the holder of a folder-scoped or deliverable-scoped review link (a client or guest), possibly with the link password.
- **Object:** `project_deliverables.status`, `share_link_approvals` rows.
- **Action:** `submit_approval` with a `file_id` or `deliverable_id` outside the link's scope.

## 3. Code paths changed

| File | Change |
|---|---|
| `supabase/functions/_shared/shareLinkScope.ts` (new) | Pure decision `decideApprovalTarget`; `approvalNeedsListing`. Fail closed: unknown scope refused; failed listing lookup answers 503 |
| `supabase/functions/redeem-project-share/index.ts` | After the existing same-project checks and before the duplicate check and the write, the target is checked against the link's own file listing (`list_share_link_files`), the single definition of the scope |
| `src/lib/__tests__/shareLinkScope.test.ts` (new) | 19 tests |

Rule now:

| Link | `file_id` | `deliverable_id` |
|---|---|---|
| project | must be in the project (listing) | any deliverable of the project |
| folder | must be a file of the folder (listing) | must be the deliverable of a listed file |
| deliverable | must be one of the deliverable's files (listing) | must equal `scope_ref_id` |
| unknown scope | refused | refused |
| no file, no deliverable | allowed (unchanged) | |

The reviewer page (`src/pages/ProjectReview.tsx`) always sends the active file's own `file_id` and `deliverable_id` from the same listing, so the normal flow is unchanged.

## 4. Canonical records reused

`project_share_links` (scope, scope_ref_id), the RPC `list_share_link_files`, `project_files`, `project_deliverables`. No new table, field or policy.

## 5. Acceptance tests

Run in this PR (pure decision and source contract): 19 passing.

To run after the paste, with three links on one project that has two deliverables D1 (files F1, F2) and D2 (file F3), and a folder holding F1:

| Link | Request | Expected |
|---|---|---|
| project | approve F3 / D2 | 200 |
| folder (F1) | approve F1 / D1 | 200 |
| folder (F1) | approve F3 | **403** `file_not_in_scope` |
| folder (F1) | approve D2 | **403** `deliverable_not_in_scope` |
| deliverable (D1) | approve F2 / D1 | 200 |
| deliverable (D1) | approve F3 | **403** `file_not_in_scope` |
| deliverable (D1) | approve D2 | **403** `deliverable_not_in_scope` |
| any | revoked or expired token | 410, unchanged |
| any | `can_approve = false` | 403 `not_allowed`, unchanged |

## 6. Remaining gaps (not addressed here)

- `can_download = false` is a UI hint: `list_files` signs a 1-hour URL for every listed file regardless, because viewing an image or a video needs it. Preventing a download would need a separate viewing path.
- Approvals are still not bound to a content version (GA PROD-04): an approval names a file or deliverable, not a version. Needs a schema proposal.
- The password brake is per instance and in memory (existing comment in the function).
- The folder link scope is `folder_id = scope_ref_id` only; nested folders are not included, as before.
- The same link can still approve more than once with a different signer name (existing duplicate window is 10 minutes per signer).

## 7. Rollback

Re-paste the previous `redeem-project-share/index.ts`. `_shared/shareLinkScope.ts` can stay: nothing else imports it.

## 8. Release state (merged is not deployed)

| Function | State |
|---|---|
| `redeem-project-share` | not deployed |

Checksums at this commit: `shareLinkScope.ts` `eb6eb1a0c7f19b083283cb3d18775c8db5362a3748b247627a0c9b213042c62d`, `redeem-project-share/index.ts` `f8da3a1b8ab343849fbdb25bc53b307ac9f15d5a46556e65da84c49a8c263de8`.
