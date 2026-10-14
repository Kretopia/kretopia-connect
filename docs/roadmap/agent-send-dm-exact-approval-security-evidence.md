# agent-send-dm: exact approval binding: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: *an approved agent action authorises exactly one send: this recipient, this text, this actor, this approval record, once.* Matrix row 9 and 12 (GA PROD-04, REL-03, REL-05; CE p.21, p.36: "a generic approved status is not exact-version approval"). Closes the gap left open in `outbound-senders-review-security-evidence.md` section 5. Repository finding (code evidence); not reproduced against production.

## 1. Threat addressed

`agent-send-dm` inserts a direct message under the caller's identity. Before this change it proved only that an `orch_actions` row of the caller was `approved` and carried an `orch_approvals` record (`evaluateExecutionGuard`). **Recipient and text came from the request body**, and nothing compared them to what had been approved. So one approved action id could be used, in the window between the orchestrator's approval claim and its final "executed" update, to send any text to any user; and nothing stopped the same approved action being used twice (the only replay barrier was the orchestrator marking it executed after the call returned).

| Actor | Object | Action |
|---|---|---|
| A signed-in user (or any code that holds their JWT, including a compromised agent step) | an `orch_actions` row of theirs in status `approved` | call `agent-send-dm` directly with that `_agent_action_id`, another `to_user_id` and another `body`; or call it twice |

## 2. Rule now

| Question | Rule |
|---|---|
| Actor | the action's `user_id`, the approving record's `user_id` and the authenticated caller are the same user |
| Action state | exactly `approved`; no `rejected`, `revoked` or `cancelled` record on it (existing guard, unchanged) |
| Approved arguments | the approving record's `edited_args` when it has one, otherwise the action's `tool_args`: exactly what the orchestrator runs |
| Recipient and text | the request's `to_user_id` and trimmed `body` equal the approved ones: `send_dm` (`to_user_id`, `body`) or the `spin_up_project` bundle (`creator_user_id`, `kickoff_message` clipped to 4000, as the bundle sends it). Case and content are not folded |
| Other tools | refused (`unsupported_tool`) |
| Missing target | approved arguments with no recipient or no text are refused |
| Freshness | the approval is at most 30 minutes old (`orch_actions.decided_at`, else the approval's `decided_at`); no readable time is a refusal; older is `410 approval_expired` |
| Once | before inserting, the action is claimed `approved -> executed` by compare-and-set; a second call, a retry or a double click gets `409 already_executed`; a failed insert releases the claim |
| Lookups | a failed action or approval lookup answers 503, not "not found" or "no revocation" |

The pure decision is `_shared/agentDmBinding.ts` (`bindApprovedDm`, composing `_shared/executionGuard.ts`). Every field it reads already exists (`orch_actions.tool_args`, `decided_at`, `status`; `orch_approvals.edited_args`, `decided_at`, `decision`).

## 3. Canonical records reused

`orch_actions` and `orch_approvals` (the canonical agent action family, matrix row 11), `evaluateExecutionGuard`. No new table, field or policy.

## 4. Tests

`src/lib/__tests__/agentDmBinding.test.ts`: 26 passing, with the 19 of `executionGuard.test.ts`. Allowed: exact recipient and text, whitespace around either, an edited approval bound to the edited text and recipient, the `spin_up_project` kickoff (also at the 4000 clip), an approval inside the window. Denied, each its own case: another recipient, another text (including case and appended content), missing or non-string recipient and text, the original draft after an edit, another user's action, another user's approval record, `proposed`, `executed`, `rejected`, a revoked record next to an approval, missing action, missing or empty approvals, unsupported tool, approved arguments with no recipient or no text or no object, expired approval, unknown approval time. Wiring: binding precedes the claim and the claim precedes the insert; compare-and-set and `409`; claim released on failure; selected fields; no direct use of the old guard.

ESLint clean. Not run: a two-account test against a real backend (none reachable from this session).

After the paste, with an approved `send_dm` action A (recipient R, text T) of user U:

| Request | Expected |
|---|---|
| U, `_agent_action_id = A`, R, T, within 30 min | **200**, one message; the action is `executed` |
| the same request again | **409** `already_executed`, no second message |
| U, A, another recipient | **403** `recipient_mismatch` |
| U, A, another text | **403** `content_mismatch` |
| another user, A | **403** `wrong_owner` |
| U, A, the same request 31 minutes after approval | **410** `approval_expired` |
| the approval flow in the app (approve, edit then approve, approve a `spin_up_project` bundle) | unchanged: the orchestrator sends what was approved |

## 5. Remaining gaps (not addressed here)

- The same exact-version gap exists in other approval-gated functions that were not re-read in this pass: `copilot-collaborator-tools` (gated by `_shared/agentAuthority.ts`), and any function that calls `evaluateExecutionGuard` and then reads its arguments from the request. `send-outreach-draft` binds the draft id but not a content hash.
- `executeAction` runs whatever `tool.handler` names with `{...args, _agent_action_id}`; a handler that does not re-check its own arguments against the action is open in the same way. An inventory of handlers is the next step.
- Idempotency is per action. A `spin_up_project` bundle that creates the project and then fails before the DM leaves the project in place (existing behaviour, flagged by its own comment).
- The 30 minute window is a code constant; a shorter or per-tool window is a product decision.

## 6. Rollback

Re-paste the previous `agent-send-dm/index.ts`. `_shared/agentDmBinding.ts` can stay: nothing else imports it. Rolling back reopens the replay and substitution described in section 1.

## 7. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/agentDmBinding.ts` | first (imports `_shared/executionGuard.ts`, in place since the earlier agent-authority work: confirm) | not deployed |
| `agent-send-dm/index.ts` | after the helper | not deployed |

Checksums at this commit: `agentDmBinding.ts` `a9c0e69b4836e9bcafc79b2f01a6972f8c23b1d3862d82fc4fb16799820cec64`, `agent-send-dm` `b207e5c82e4f03b2f9bd299a9c24abd970adfa02e366a5194fcb1bdd1d43dead`, `executionGuard.ts` (dependency, unchanged) `1bf3559a6e4beda1d5da597c5764b7811ad9cbb505a17cac708ff82850aa0fb3`.
