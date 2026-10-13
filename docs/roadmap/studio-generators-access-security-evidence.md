# Studio generators access: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: *a function that spends the owner's AI quota or writes into a project with the service role decides membership from the canonical records: the owner, or an accepted operator.* Matrix rows 3, 5 and 18 (GA SEC-02, SEC-05, AUX-03; CE p.32). Repository findings (code evidence); none was reproduced against production.

## 1. What was reviewed

The adoption inventory asked for in PR #157's remaining gaps: every edge function that names `project_collaborators` (17 files). Four decided membership with "any `project_collaborators` row": no `status`, no `role`.

| Function | What a "member" can do through it | Before | Now |
|---|---|---|---|
| `generate-moodboard-image` | spends the AI gateway, uploads to `project-files`, inserts a `project_files` row (service role). No quota gate | any row | owner or accepted collaborator / creative |
| `generate-studio-copy` | spends the studio AI quota, uploads to `project-files`, inserts `creative_assets` | any row, read through the caller's RLS | same |
| `studio-ingest` | model call, then writes `studio_facts` and `studio_entities` with the service role (the Studio Brain every later AI answer reads) | any row, read with the service role | same |
| `match-event-guests` | treats a collaborator as event host: reads every RSVP'd guest's profile (bio, location, skills, answers) with the service role, writes `event_guest_matches` | any row | same, for the event's project |

Reviewed and left alone:

| Function | Why |
|---|---|
| `generate-studio-image` | Same flaw, fixed in PR #157 (kept out of this PR to avoid a conflict; it can adopt the shared helper afterwards) |
| `optimize-event-seating` | Already filters `status = accepted` (no role filter) |
| `copilot-collaborator-tools`, `sponsor-radar`, `send-push-notification` | Filter `status = accepted`; they list or notify, they do not gate |
| `desk-agent` | Gates with the SQL helper `user_has_project_access` (accepted-only after migration `20261009090200`) |
| `send-user-email`, `send-project-invitation`, `accept-project-invitation`, `redeem-project-guest-link`, `agent-orchestrator`, `copilot-executor`, `project-og-image` | Invitation, creation or notification flows, not membership gates |

## 2. Affected actor, object, action

- **A pending invitee, an accepted guest, an accepted client** of a project: run an AI generator on it, add facts to its Studio Brain (`studio-ingest`), or run guest matching on its event.
- **Object:** the owner's AI quota, `project-files`, `creative_assets`, `studio_facts`, `studio_entities`, `event_guest_matches`, guest profile data.

## 3. Rule now

| Standing on the project | Result |
|---|---|
| Owner (`projects.created_by`) | allowed |
| Accepted collaborator (`member` is normalised to collaborator), accepted creative | allowed |
| Accepted client, accepted guest | refused (403) |
| Pending invitee, any invited role | refused (403) |
| Unrelated user, unknown project, malformed id | refused (403) |
| Several accepted rows | the lowest tier decides (creative + client = client) |
| A lookup failed | 503, grants nothing |

One definition: `_shared/studioAccess.ts` (`STUDIO_OPERATOR_ROLES`, `studioOperatorAccess`, `guardStudioOperator`) on top of `requireProjectAccess` in `_shared/projectAccess.ts`, which is not modified.

## 4. Canonical records reused

`projects.created_by`, accepted `project_collaborators` rows through `requireProjectAccess`. No new table, field or policy.

## 5. Tests

`src/lib/__tests__/studioAccess.test.ts`: 15 passing, over an in-memory stand-in for the service-role client. Roles: owner, accepted collaborator, accepted creative, accepted client, accepted guest, pending collaborator, pending creative, unrelated user, unknown project, malformed id, missing user, creative + client at once, lookup failure on each of the two tables. Wiring tests check, per function, that the decision precedes the model call, the quota spend and the service-role writes, and that the old "any row" query is gone.

After the paste, with five accounts on one project (owner, accepted creative, accepted client, accepted guest, pending invitee) and one unrelated account:

| Action | owner | creative | client | guest | pending | unrelated |
|---|---|---|---|---|---|---|
| `generate-moodboard-image` | 200 | 200 | 403 | 403 | 403 | 403 |
| `generate-studio-copy` | 200 | 200 | 403 | 403 | 403 | 403 |
| `studio-ingest` | 200 | 200 | 403 | 403 | 403 | 403 |
| `match-event-guests` (event of that project) | 200 | 200 | 403 | 403 | 403 | 403 |

## 6. Behaviour changes to be aware of

- **Accepted clients and guests lose generator access.** If a product decision wants a client to be able to drop material into the Studio Brain, that is a role decision (a new role tier or a per-action flag), not a reason to widen this check.
- `studio-ingest` answered 404 for an unknown project and now answers 403 like every other refusal (no existence oracle).
- `match-event-guests` answers 503 instead of 403 when the project lookup fails and the caller is not otherwise a host or co-host.

## 7. Remaining gaps (not addressed here)

- The role tier of these generators is a code decision, not a database rule: a direct write to `studio_facts` through the data API is governed by that table's RLS, which was not read.
- Functions that gate with the SQL helper `user_has_project_access` (`desk-agent`, `thrive-ai-chat`, `desk-ai`, `scope-guardian`, `import-*`, `create-video-room`, `mint-video-token`, ...) depend on its applied definition and do not separate roles (a client passes). Applied state of `20261009090200` is unverified from here.
- `generate-studio-image` still carries its own copy of the role list until PR #157 and this PR are both merged.

## 8. Rollback

Re-paste the previous version of the changed function. `_shared/studioAccess.ts` can stay: nothing else imports it.

## 9. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/studioAccess.ts` | first (needs `_shared/projectAccess.ts`, present and equivalent in `kretopia-app` as read on 2026-10-13) | not deployed |
| `generate-moodboard-image`, `generate-studio-copy`, `studio-ingest`, `match-event-guests` | after the helper | not deployed |

Checksums at this commit: `studioAccess.ts` `78191121643dbdd587330a61677b09f26c39b29c742ddf69018b0934822e1461`, `generate-moodboard-image` `aa42f35f6842fb79f9341c70217bc224e66a8b169b1fab264cc226adb45dfbd8`, `generate-studio-copy` `31fa73a68eca9c0855085fa9c963b16ab5cd6ec9fe845e5f173e9977e01261cc`, `studio-ingest` `45cbf09c795da0ec7ebfb430e09819d9f12fc41177deb9892db21da0ca218a4e`, `match-event-guests` `edaf70396fbfdcefc297a31ea336d49b81c884a3df25e49aacc400ff6515bc9f`.
