# Agent handlers: an approval covers exactly what it named: inventory and security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: *an approved agent action authorises one execution of one named target.* Matrix rows 9 and 12 (GA PROD-04, REL-03, REL-05). Continues PR #163 (`agent-send-dm`). Repository findings (code evidence); none was reproduced against production.

## 1. Inventory: which handlers re-check what was approved

`agent-orchestrator` executes a tool by calling its registered handler with `{...approved args, _tool, _agent_action_id, _source}` under the user's JWT. The orchestrator itself enforces propose, approve, then execute (a compare-and-set claim). The question is what each **handler** does with the action id. 25 handlers are registered; the ones that can act irreversibly or externally and are `requires_approval`:

| Handler | Tools | Handler-level check on the approval | After this PR |
|---|---|---|---|
| `agent-send-dm` | `send_dm`, the bundle's kickoff DM | bound to recipient and text, fresh, once (#163) | unchanged |
| `copilot-collaborator-tools` | `delete_project`, `remove_collaborator` | **status only**: any approved action of the same tool; no approval record, no target, no freshness, reusable | **bound to the project (and the person), approval record, fresh, once** |
| `copilot-collaborator-tools` | `add_collaborator`, `archive_project` | none (the desk agent door binds person and project itself; the handler treats the JWT as a human) | not changed: add is bound upstream in `desk-agent`; archive is reversible |
| `send-outreach-draft` | `send_outreach_email` | an approved action of **any** tool was accepted (`expectedTool` not passed); the draft check was skipped when `draft_id` was absent; reusable | **tool-bound, draft required, approval record, fresh, once** |
| `desk-agent` | `add_collaborator` (via approval) | bound to person and project (existing) | unchanged |
| `send-user-email`, `send-outreach-email`, `send-credit-invite`, `send-get-paid-link`, `send-notification-email` | `send_message`, `apply_to_gig`, `request_vouch`, `send_payment_link`, `send_reminder` | none: the handler cannot tell an approved agent action from a person; their own caller and recipient controls were hardened in #161, #162, #165 | open, see section 4 |
| `verify-credit` | `publish_credit` | none | open |
| `enhance-gig`, `extract-event-details` | `create_gig`, `create_event` | none | open |
| `thrive-creative-tools` | `negotiate_rate`, `recycle_pitch` | none | open |
| `thrive-memory-tool` | `forget_memory` | none | open |
| `create-payment` | `charge_card` (`locked`) | no function file in the repository: the tool is locked and cannot run | none |

## 2. Findings fixed

| # | Where | Threat | Now |
|---|---|---|---|
| H1 | `authorizeHighStakesAction` (`_shared/agentAuthority.ts`) used by `delete_project` and `remove_collaborator` | an action approved to delete project A could delete project B, any project the caller owns (and one approved removal could remove another person), in the window before the orchestrator marks it executed; the approval **record** was never required; no freshness; reusable | the target is compared with the approved argument (`edited_args`, else `tool_args`); the approval record is required and unrevoked; 30 minutes; the action is claimed `approved -> executed` by compare-and-set before the mutation and released if the mutation failed. A call that names no target is refused (fail closed) |
| H2 | `send-outreach-draft`, agent path | an approved action of **any** tool authorised sending any draft (`expectedTool` was not passed, and the draft check only ran when the approved arguments held a `draft_id`) | `send_outreach_email` only, the draft must be named by the approval, approval record, 30 minutes, claimed before the mail leaves, released if the send fails |

Reused unchanged: `evaluateExecutionGuard` (owner, tool, status, approval record, revocation). New pure module: `_shared/agentActionBinding.ts` (`bindApprovedAction`, generalising #163's DM binding to named targets).

## 3. Tests

`src/lib/__tests__/agentActionBinding.test.ts`: 31 passing.

- `bindApprovedAction`: the approved project, another project (the replay), `target_project_id`, edited arguments, missing or empty requested target, an approval that names no project, no target specified; remove: the approved person and project, another person, another project, no person named; another user's action, a different tool, `proposed` / `executed` / `rejected`, approved status with no approval record, a revoked record, an expired approval, unknown time, missing action.
- `authorizeHighStakesAction` over an in-memory stand-in for the service-role client: authorises once and then refuses (409); another project leaves the action unused; an agent id with no named target is refused; approved with no record is refused; failed lookups and a failed claim answer 503 and claim nothing; the claim is released; a human through the app's UI still proceeds and a desk agent without an approval is still refused (428).
- `send_outreach_email`: the approved draft, another draft, an approved task action, an approval with no `draft_id`, late, rejected, someone else's; wiring (tool-bound, draft required, claim before `sending` and before SMTP, released on failure).

ESLint clean on the new files (the one `no-explicit-any` reported in `send-outreach-draft` is existing). Not run: a two-account test against a real backend.

After the paste, with an approved `delete_project` action A for project P of user U, and a second project Q of U:

| Request | Expected |
|---|---|
| U, `_agent_action_id = A`, project P, within 30 minutes | **200**, P deleted, action `executed` |
| the same again | **409** (already executed; also P is gone) |
| U, A, project Q | **403** `different project`, Q intact, A still `approved` |
| an approved `create_task` action id used as `_agent_action_id` on `send-outreach-draft` | **403** (wrong tool) |
| the app's own Delete project button (no agent markers) | unchanged |

## 4. Remaining gaps (not addressed here)

- **The markers are caller-asserted.** `_agent_action_id` and `_source` are request fields. A caller that omits them is treated as a person acting in the app, which is by design for the UI and also what an agent that skips them would look like. Binding the human path needs a proof of human origin in the UI call (a signed interaction token): a separate design.
- **Handlers with no handler-level check** (section 1, "open"): they run as the user. Their approval is enforced at the orchestrator only. By blast radius the next ones to bind, if the same pattern is wanted, are `publish_credit` (`verify-credit`), `send_message` (`send-user-email`), `apply_to_gig` (`send-outreach-email`) and `forget_memory`.
- **Door mismatch:** `desk-agent` runs `create_project` immediately although the registry marks it `requires_approval` (the project is created by and for the caller; low impact, noted).
- **Content of a draft after approval:** `send-outreach-draft` binds the draft id; the draft's subject and body can still be edited between approval and send. `outreach_drafts.updated_at` exists but no trigger is known to maintain it, so it cannot be used as a version; a content hash at proposal time needs the proposer to store one (a code change in the orchestrator plus the field in `tool_args`, no schema).
- The 30 minute window is a constant of the helper.

## 5. Rollback

Re-paste the previous `copilot-collaborator-tools/index.ts`, `send-outreach-draft/index.ts` and `_shared/agentAuthority.ts` (they go together: the tools pass `targets`, which the previous authority ignores). `_shared/agentActionBinding.ts` can stay. Rolling back reopens H1 and H2.

## 6. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/agentActionBinding.ts` | first (imports `_shared/executionGuard.ts`, present) | not deployed |
| `_shared/agentAuthority.ts` | after the helper | not deployed |
| `copilot-collaborator-tools/index.ts`, `send-outreach-draft/index.ts` | after the authority | not deployed |

Checksums at this commit: `agentActionBinding.ts` `4ce30064acc9352ef2a120c8b6cf2b5b1878cced5299130c6e519ee088b9ba2c`, `agentAuthority.ts` `2a2f6d79b687df07466eefa96f5faf8cb78ad3d5776dab5f9e16cff6beafb32c`, `copilot-collaborator-tools` `74142ef4449f5714cc0e5f48f3aa2026fa961c28ecb8abd8c33101ddd988cb3e`, `send-outreach-draft` `9ff7c63cdc860767694c93581d35e0a279afaceb9064d566bce1c6e3c8f0b76e`.
