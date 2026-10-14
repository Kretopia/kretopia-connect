# Outbound senders, second pass: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`.

Gate: same as `outbound-senders-security-evidence.md` (PR #161): *what makes Kretopia send a message is triggered by a proven actor, with a bounded blast radius, and puts no unescaped request text in a header or a mail from our own domain.* This pass reads the fourteen senders that file left as "signal only". Repository findings (code evidence); none was reproduced against production.

## 1. Result for the fourteen

| Function | Read | Finding | Action |
|---|---|---|---|
| `send-phone-otp` | yes | **F1** any signed-in user could send an SMS or WhatsApp code to any number, with no limit, on our Twilio account (SMS pumping). **F2** the code came from `Math.random`, sat in clear text in `profiles.phone_otp`, and could be guessed without limit for ten minutes: the public "phone verified" badge was guessable. **F3** requesting a code for a new number overwrote `phone_number` while `phone_verified` stayed `true`: the badge moved to an unproven number | fixed |
| `merge-accounts-init` | yes | **F4** the codes were never delivered (it called the transactional sender with `template`, `recipient_email`, `data`, which that function does not read, and no `account-merge-otp` template exists) and the fallback wrote each code and its address to the function logs in clear text. **F5** it returned a masked email for any user id: a user-id-to-address oracle. **F6** no limit on requests that mail two inboxes; `Math.random` codes; a client-supplied `face_match_score` stored | fixed |
| `send-outreach-email` | yes | **F7** `send_sequence` read and updated the lead of the sequence without scoping it to the caller (another user's lead could be mailed and its `last_contacted_at` written, via a sequence pointing at it). **F8** recipient and subject went unvalidated into the mail; the From display name carried the profile name unfiltered (`<`, `"`) | fixed |
| `verify-brand-credit` | yes | **F9** brand address unvalidated; creator name, project title and brand name unescaped in a branded mail | fixed |
| `agent-send-dm` | yes | approval-gated (`evaluateExecutionGuard`): proves an approved action of the caller exists, but **not** that it names this recipient and body | **gap** (section 5) |
| `send-outreach-draft` | yes | approval-gated and bound to the draft (`wrong_draft`) | none |
| `send-project-invitation` | yes | project access via `user_has_project_access`; values escaped; mirrors the DB invite policy, which is role-agnostic by design (`20261009090200`) | none |
| `notify-speed-pool-ping`, `notify-speed-session-update`, `notify-swipe` | yes | caller must be the session host or an admin; swipe notification requires the caller's own swipe on the recipient | none |
| `rsvp-speed-session` | yes | mails the caller's own address only | none |
| `send-invoice-chase` | yes | drafts for the caller's own invoice; sends nothing | none |
| `thrivefund-create-pledge` | yes | a checkout creator, not a mail sender; payment flow, out of this gate | none |
| `complete-product-purchase` | yes | mails the buyer's own address; entitlement fixed in #157 and #159 | none |

## 2. Rules now

| Function | Rule |
|---|---|
| `send-phone-otp` | number is 8 to 15 digits, optional `+`; a new code is refused with 429 for 60 s after the last one (the send time is `phone_otp_expires_at` minus ten minutes: no new column); the code is six digits from the platform CSPRNG, stored as `v2:<attempts>:<sha256(user:code)>`; each guess is recorded by compare-and-set **before** it is evaluated; the fifth wrong guess burns the code; a plain six-digit value written before this change still verifies until it expires; a code for a different number clears `phone_verified`; a Twilio refusal clears the unusable code, so the user is not locked out of the cooldown |
| `merge-accounts-init` | at most 3 requests per initiating account per hour (counted before anything is created or mailed); `face_match_score` is stored as `null`; CSPRNG codes; a failed delivery marks the request `failed` and answers 503, and no code is ever logged; the response shows no address of the other account |
| `send-outreach-email` | recipient is one plain address, subject one line of at most 200 characters, display name stripped of `<>"\`; a sequence's lead is read and written only if it is the caller's |
| `verify-brand-credit` | one plain brand address and a clipped brand name before anything is stored; creator name, project title and brand name escaped, subject on one line |

Helpers: new `_shared/phoneOtp.ts` (pure; only Web Crypto); reuses `_shared/outboundText.ts` from PR #161.

## 3. Tests

`src/lib/__tests__/phoneOtp.test.ts`: 23 passing: code range and bias-free redraw; number cleaning; cooldown (first code, seconds ago, past the cooldown, expired, unreadable expiry); stored-value round trip, legacy read, salting by user; guess plans (right code, wrong code, last guess burns, exhausted attempts refuse even the right code, expired, missing, malformed, another user's value, legacy plain code); wiring for the four functions (no `Math.random`, cooldown before Twilio, compare-and-set before `phone_verified: true`, no code in logs, cap before insert, leads scoped, validated address in `to`). ESLint clean. Not run: a real Twilio send and a two-account test.

After the paste:

| Request | Expected |
|---|---|
| `send-phone-otp` send twice within a minute | 200, then **429** with `Retry-After` |
| `send-phone-otp` verify: 5 wrong codes, then the right one | 400 x4, **429** on the fifth, then "expired": a fresh code is needed |
| `send-phone-otp` send for a new number while verified | profile shows `phone_verified = false` until confirmed |
| `merge-accounts-init`, 4th request within an hour | **429** |
| `merge-accounts-init` while the template is missing | **503**, row `failed`, nothing in the logs |
| `send-outreach-email` `send_sequence` for a sequence pointing at another user's lead | "No recipient email" (the lead is not readable), no mail, no write |

## 4. Behaviour changes to be aware of

- Verifying a phone with a pre-change code still works until it expires; after this paste every new code is hashed.
- A second code request inside a minute now fails; the UI shows the error text of the response.
- The merge flow answers 503 until a delivery template exists (section 5). It could not complete before either; it now says so instead of writing the codes to a log.

## 5. Remaining gaps (not addressed here)

- **Merge codes cannot be delivered**: no `account-merge-otp` transactional template exists. Adding one is product and design work (and a new email template), not a security fix; until then merging accounts is unavailable.
- **`agent-send-dm`**: the approval proves an approved action exists for the caller, not that it names this `to_user_id` and `body`: an approved action id can be reused for another recipient and text (GA PROD-04 / matrix row 9, "generic approved is not exact-version approval"). The legitimate bundle caller derives the recipient and text inside the bundle, so binding needs the action's stored arguments compared to the request; a separate slice.
- **Volume**: there is no durable per-account send ledger (schema), so a signed-in user is limited per minute (OTP) or per hour (merge, guest posts), not per day. A global Twilio spend cap belongs in the Twilio console, not in code.
- `send-outreach-email` stores a user's Gmail app password in `user_email_settings.gmail_app_password` in clear text (secret at rest); moving it to the secret store or encrypting it is a schema and key-management change.
- `phone_otp` and `phone_otp_expires_at` also exist in the profile split tables created on 2026-07-08; this function still reads `profiles`. Not checked which one is the live source.
- The body of `send-outreach-email` is not escaped: it is the sender's own composed text and its author is the sender (a mail sent from our domain with their name), but a per-account daily cap is the real control.

## 6. Rollback

Re-paste the previous function. `_shared/phoneOtp.ts` can stay: only `send-phone-otp` and `merge-accounts-init` import it. A code stored as `v2:...` by the new `send-phone-otp` is not readable by the old one; if rolled back, users re-request a code (at most ten minutes).

## 7. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/outboundText.ts` (from PR #161) | first, if not already pasted | not deployed |
| `_shared/phoneOtp.ts` | before the two functions that import it | not deployed |
| `send-phone-otp`, `merge-accounts-init` | after `phoneOtp.ts` | not deployed |
| `send-outreach-email`, `verify-brand-credit` | after `outboundText.ts` | not deployed |

Checksums at this commit: `phoneOtp.ts` `5aca7213c73f2171f1f7ac83556960ba1df1c16872672243bd669b747907a508`, `send-phone-otp` `3a1334b2f27e8a6b0f4017e8a81d3a9c5bb7e007e0df02945268fc8c0d812e89`, `merge-accounts-init` `131286ca7d7b01bf87d19a496a2fa8c2100d62d26cc2eac4b8097732450df9fa`, `send-outreach-email` `02d53136518c4ca0503bcca56064bbf48fca9eab2ac52e61f15b6c9401e0cacd`, `verify-brand-credit` `49dbc26a1cc01cbdd5063243fe43b9cd660fc51169c4e9a3475164eb17f93130`.
