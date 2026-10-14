# Proposal: delivery of the account-merge verification codes

Proposal only. **Nothing here was applied, and nothing here is runnable.** It adds no provider. The template it asks for is product and design work that the owner approves; this document specifies what it must do.

Covers the finding of the second outbound pass (`outbound-senders-review-security-evidence.md`, F4): the merge flow cannot deliver its codes. Matrix row 18 and the program item "account-merge OTP delivery template".

## 0. Prerequisite: capture the live state (read-only)

- whether any `account_merge_requests` row ever reached `completed` (a count by `status`); if none, the feature has never worked in production;
- the transactional template registry of the deployed `send-transactional-email` (names only);
- the merge dialog's current copy (`src/components/account/MergeAccountsDialog.tsx`, `ManualMergeAccountPanel.tsx`).

## 1. Objects affected and current unsafe behaviour

| # | Object | Behaviour (repository evidence) |
|---|---|---|
| M-A | `merge-accounts-init` | creates a request, hashes two six-digit codes (one for each account's address) and asks `send-transactional-email` to send template `account-merge-otp`. No such template exists in the registry, and the request used keys the sender does not read, so **no code was ever delivered**. Its fallback wrote each code and its address to the function logs in plaintext; PR #162 removes that and makes the failure explicit (503, request marked `failed`) |
| M-B | `merge-accounts-verify` | requires both codes, five attempts, then runs `merge_user_data(source, target)`, deletes the source auth user and its profile. It is a destructive, irreversible action gated only by the two email codes |
| M-C | the flow as a whole | merging deletes an account: the only proof of ownership of the source is a code mailed to its address. The initiator is signed in to the target only |

## 2. Target

1. Two codes are delivered, one to each address, by the existing transactional sender, from a template that exists and is registered.
2. The codes carry no link that performs the merge; they are typed into the dialog by the signed-in initiator (so a mailbox preview cannot complete it).
3. The mail says what is about to happen, to which two accounts (masked), by whom (the initiating account's masked address), that a code expires in 20 minutes (the table default), and that ignoring it changes nothing.
4. The destructive step has one more confirmation after both codes are accepted, naming the account that will be deleted.
5. No code is ever logged, returned or shown anywhere but the two inboxes.
6. A request that cannot deliver is `failed`, not `pending`.

## 3. The template (content specification, not a design)

| Field | Value |
|---|---|
| name | `account-merge-otp` (registered in the sender's template registry; the init function already uses this name and the correct keys after PR #162) |
| recipients | the source address and the target address, as two separate mails with different wording |
| variables | `code` (six digits), `role` (`source` or `target`), `otherAccountMasked`, `expiresInMinutes` |
| source wording | "Someone is asking to merge your account into another one. If this is you, enter this code. If it is not, do nothing: your account is not changed." |
| target wording | "You asked to merge another account into this one. Enter this code with the other account's code." |
| must not contain | a link that acts, the full address of the other account, a recovery or sign-in link |
| layout | the shared dark email kit; no new design system |

## 4. Migration sketches

None: no schema change is needed. `account_merge_requests` already has `source_otp_hash`, `target_otp_hash`, `attempts`, `status` including `failed`, `expires_at`. The proposal is a template (a registry entry and its component), plus two small code changes after approval:

```
-- NOT RUNNABLE, for review of intent only
-- 1. register the template: one entry in the transactional template registry
-- 2. merge-accounts-init: pass the masked address of the initiator as <otherAccountMasked>, <role>, <expiresInMinutes>
-- 3. merge-accounts-verify: an explicit second confirmation field bound to the request id before
--    <merge_user_data> runs; a failed merge keeps the source account untouched (already so)
```

## 5. Data migration, backfill and compatibility

None. Existing `failed` and `expired` rows stay as history. Requests created while no template existed are `failed` after PR #162 and cannot be resumed.

## 6. RLS impact by role

None (the table's policies already deny client writes).

## 7. Decisions needed from the approver

1. **Whether the merge feature is wanted at all.** It deletes an account on the strength of two emailed codes; the alternative is to keep it off and let support perform merges.
2. **Wording** of the two mails (a legal and tone decision).
3. **The second confirmation** before deletion: required (recommended) or not.
4. **Anyone may start a merge** for any target they are signed in to, with any source id: whether the source must first be offered by `find_duplicate_account_candidates` (stricter), or the typed address lookup stays.

## 8. Rollout sequence

1. Capture section 0.
2. Template and the init change in one PR, pasted manually.
3. Send a real merge request between two test accounts of the owner; read both mails; complete the merge on throwaway data.
4. The second confirmation in a follow-up PR.
5. Only then enable the entry point in the account settings if it was hidden.

## 9. Rollback

Re-paste the previous `merge-accounts-init`; with the template unregistered the flow returns the explicit 503 of PR #162. Nothing is deleted by a rollback.

## 10. Tests required before enabling

Roles: initiator (target account), the source account's owner, an unrelated signed-in user, anonymous.

| Case | Expected |
|---|---|
| initiator starts a merge | two mails, each with its own code, none logged |
| the initiator enters one correct and one wrong code | refused, attempt counted; the fifth wrong attempt locks the request |
| both codes, second confirmation missing | not merged |
| both codes and the confirmation | merged once; a second call answers `completed`, does nothing |
| an unrelated user submits the request id | 403 |
| the codes after 20 minutes | refused, request `expired` |
| the template is missing | 503, request `failed`, nothing in the logs |

## 11. Estimated blast radius

Very low while the feature is off. Once on: an irreversible deletion of one account, bounded by two codes, five attempts, a time window and (if approved) a second confirmation.

## 12. Not in scope

Duplicate detection quality (`find_duplicate_account_candidates`), the face-match idea (the client-supplied score is no longer stored), merging data between workspaces (Company Experience, after its own gate).
