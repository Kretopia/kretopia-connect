# RLS test plan

Run against a staging copy or a local database seeded with fixtures, never production. Plain SQL plus the existing vitest handler tests; no new dependency.

## Actors (one fixture user each, same project P and meeting M)
owner, collaborator (accepted, role `member`), creative (accepted), client (accepted), guest (accepted, role `guest`), pending (invited, not accepted), denied (`meeting_participants.status = 'denied'`), removed (status `removed`, or collaborator row deleted), unrelated (signed in, no link), anonymous (anon key, no session).

## Method
1. Seed fixtures with the service role.
2. For each actor: `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<uid>","role":"authenticated"}', true);` run the probe; `rollback;`. Anonymous: `set local role anon`.
3. Compare with the matrix. Any difference is a failed test; a **must-deny** that passes is a SEV2.
4. Edge path: run `getRecordingLink.test.ts` and the handler tests in `src/lib/__tests__/edge` for the same actors.

## Expected results (A allow, D deny, L allow only if listed, `*` = the contract says deny but production allows today)
| Object and action | owner | collab | creative | client | guest | pending | denied | removed | unrelated | anon |
|---|---|---|---|---|---|---|---|---|---|---|
| `projects` select | A | A | A | A | A | D | D | D | D | D |
| `projects` update | A | A* | A* | A* | A* | D | D | D | D | D |
| `project_files` / `project_messages` select | A | A | A | A | A* | D | D | D | D | D |
| `milestones` amounts select | A | A | A | D | D | D | D | D | D | D |
| `milestones` update status | A | D | D | D | D | D | D | D | D | D |
| `call_transcripts` select (project call) | A | A | A | L | D | D | D | D | D | D |
| `get-recording-link` (project call) | A | A | A | L | D | D | D | D | D | D |
| `call_transcripts` select (meeting call) | host only | D | D | D | D | D | D | D | D | D |
| `meeting_participants` token (`mint-meeting-token`) | A | A | A | A | A | A | D | D | D | D |
| `credits` insert own / other | A / D | A / D | A / D | A / D | A / D | A / D | A / D | A / D | A / D | D / D |
| `profiles` select via `public_profiles_safe` | A | A | A | A | A | A | A | A | A | A |
| `profiles` select base table, other user | D | D | D | D | D | D | D | D | D | D |
| `notifications` select other user's | D | D | D | D | D | D | D | D | D | D |
| `wallets` / `wallet_transfers` other user's | D | D | D | D | D | D | D | D | D | D |
| `storage` `project-files` read / write | A / A | A / A | A / A | A / D | D / D | D / D | D / D | D / D | D / D | D / D |
| `storage` `meeting-recordings` | D | D | D | D | D | D | D | D | D | D |

## Divergences open today (from `docs/roadmap/canonical-product-and-permission-map.md`, rechecked on production 2026-10-19)
- `projects` UPDATE has no `WITH CHECK`, no guard trigger, and `created_by` is updatable: any accepted member, whatever the role, can take ownership (`schema-impact-report.md` M0a). Test: a guest-role member sets `created_by` to self; it must fail.
- Guests read every project message and file (no audience flag).
- Pending is no longer access (`user_has_project_access` excludes it) and the self-accept role pin exists (`trg_guard_project_collaborator_self_update`); keep both under test.

## Extra must-deny probes
- Any signed-in user UPDATEs `call_transcripts.recording_id`, `created_by`, or `project_id` on their own row (currently allowed; see `SECURITY_BASELINE.md` section 1).
- `anon` calls each admin RPC (`admin_*`, `get_product_kpis`, `get_user_email`): expect an error or empty result.
- A user reads a transcript after being removed from the project: deny on the next request.
- A pending invitee opens a project recording link: 403.
- `anon` inserts into each intake table with a 1 MB payload: expect rejection or a size cap.

## Pass criteria
Every cell matches; every must-deny fails closed; results are saved with the commit SHA. Re-run on every migration that touches policies, grants, or SECURITY DEFINER functions.
