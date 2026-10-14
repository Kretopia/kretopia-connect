# Security deployment bundle, steps E to Q (manual paste into `kretopia-app`)

Source: `Kretopia/kretopia-connect` `main` at `5d4c6c8b0` (PRs #142 to #162 merged) plus PR #163 at `1751ce4fb` (agent-send-dm, **open**). Checksums are of the files at those commits; recompute them after #163 merges (`git show main:<path> | shasum -a 256`).

**Nothing here is deployed.** Merged is not deployed: production runs the pre-slice copies. This document is the only artefact that tells you what to paste, in what order, how to check each step and how to undo it. It does not deploy anything and contains no SQL.

A local, untracked copy of every file, numbered in paste order, with `SHA256SUMS` and `INDEX.txt`, is in `deploy-bundle-e-to-q/` in the working tree of this session (not committed).

## 1. Merge readiness of the open PRs

| PR | State | Recommendation |
|---|---|---|
| #159 product file path ownership | **merged** 2026-10-14 03:08Z | done |
| #160 commerce schema proposal (docs) | **merged** 2026-10-14 03:09Z | done |
| #161 outbound senders | **merged** 2026-10-14 03:32Z | done |
| #162 outbound senders, second pass | **merged** 2026-10-14 03:56Z | done |
| #163 agent-send-dm exact approval | open, 4 files, 26 + 19 tests, no schema | **MERGE NOW** after review: no dependency on another PR; it only takes effect once its two files are pasted |

The four PRs the request listed as open were already merged when this was checked; the pending one is #163.

## 2. Gates: what can be pasted when

| Class | Steps | Condition |
|---|---|---|
| Deployable without preflight | E, F, G, J, K, L, M, P, Q | none beyond the pre-checks of section 3 |
| Deployable, with one check first | N | a scheduled job that calls `send-activity-digest`, `send-streak-warning` or `send-reengagement` must send `x-cron-secret` first, or its next run answers 401 (same header pattern as `security/cron-secret-headers-2026-10-09.sql`; `cron.job` cannot be listed from the repository) |
| Preflight gate **satisfied**, product decision open | I | The Circle and project preflights were run on 2026-10-13: A1 0 rows, A2 `circle_meetings = 0`, `circle_hosts = 0`, `circle_meetings_90d = 0`, A3 0 rows: **GO** (the Circle gate is GO on an empty population: the first real Circle meeting is the only evidence). Open: `StartMeetingDialog` sends no `record_consent`, so meetings it creates stop being recorded and transcribed once `create-meeting` is pasted. Either accept that, or ship a consent control in the dialog first (a legal-copy decision, not code alone) |
| Product decision | H (consent default: the booking page checkbox is pre-ticked), I (above), P `merge-accounts-init` (merging stays unavailable: no delivery template) | owner decision |
| **Blocked: SQL (M-A)** | none of E to Q depends on it | M-A needs B1 to B5 reviewed. State: B1 GO (definition identical), B2 **NO-GO** as designed (`anon` and `authenticated` can execute `is_meeting_member` and `is_meeting_host` with a caller-supplied user id: design decision), B3 policies GO (5 of 5) but functions and views not returned, B4 only the realtime publication returned, B5 not returned. Until then a `denied` or `removed` participant still reads meeting rows, recordings, transcripts and realtime through the data API |
| Blocked: schema proposals (unapplied) | none | commerce (#160), meetings (M-A to M-E), and `proposal-outbound-send-registry.md`, `proposal-gmail-credential-storage.md`, `proposal-twilio-spend-controls.md`, `proposal-account-merge-otp-template.md` |

## 3. Pre-checks, before the first paste

1. In `kretopia-app`, save the **currently deployed copy of every function listed in section 5** (the rollback artefact). Name them `<function>__before.ts`. Helpers that are new need no copy.
2. Confirm these existing shared files are present (the bundle imports them and does not replace them):

| Existing file | Needed by |
|---|---|
| `_shared/admin-guard.ts` | `send-activity-digest`, `send-reengagement`, `send-streak-warning` |
| `_shared/aiModels.ts` | `generate-moodboard-image`, `generate-studio-copy`, `generate-studio-image`, `match-event-guests`, `send-outreach-email`, `studio-ingest` |
| `_shared/aiRateLimit.ts` | `match-event-guests`, `studio-ingest` |
| `_shared/milestoneProjectSync.ts` | `stripe-marketplace-webhook` |
| `_shared/promptIsolation.ts` | `studio-ingest` |
| `_shared/resolveMilestonePayee.ts` | `stripe-marketplace-webhook` |
| `_shared/stripeEnv.ts` | `complete-product-purchase`, `get-download-urls`, `stripe-marketplace-webhook` |
| `_shared/studioAIGate.ts` | `generate-studio-copy`, `generate-studio-image` |

3. Confirm secrets are present (presence only): `DAILY_API_KEY`, `DAILY_WEBHOOK_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY` (or the mode-specific keys), `RESEND_API_KEY`, `TWILIO_*` for `send-phone-otp`, `CRON_SECRET`.
4. Name the person who watches the function logs for the first 15 minutes after each deploy.
5. Integrity: in `deploy-bundle-e-to-q/`, `shasum -a 256 -c SHA256SUMS` prints OK for every file.

## 4. Shared helpers (paste all of these first, in this order)

A helper is imported by functions; it is not an Edge Function and is not deployed on its own. Pasting a helper changes nothing until a function that imports it is deployed. Rollback of a helper: none needed (old code does not import it); remove it only if you want the tree clean.

| # | Paste to `supabase/functions/` | Imported by steps | Imports | SHA-256 | Note |
|---|---|---|---|---|---|
| 01 | `_shared/roomSessionLimits.ts` | E, I | none | `f2aa42fe244c9659555bc10953a675ef7df51019a6d535816553c951a3a5961a` | ABSENT in kretopia-app (HTTP 404 on 2026-10-13). mint-meeting-token and create-meeting fail to start without it |
| 02 | `_shared/meetingParticipantAccess.ts` | E, F | none | `f2dc1c33ed6a0faea0a5b2d85bbb320254c9e0b65a847d0886017976da863364` | new |
| 03 | `_shared/projectAccess.ts` | F, I, K, L, N | none | `0a0b3cb8b1dabcf1c5628f5464c9ad714f1f85e7a968f3450a3ef91867b4a092` | present and equivalent on 2026-10-13: compare the SHA-256, paste only if it differs |
| 04 | `_shared/executionGuard.ts` | Q | none | `1bf3559a6e4beda1d5da597c5764b7811ad9cbb505a17cac708ff82850aa0fb3` | existing (agent authority work): compare the SHA-256, paste only if absent or different |
| 05 | `_shared/recordingAccess.ts` | F | meetingParticipantAccess | `204705a2593ba496956dccf9d4ed4d45e215d4ad2f64934eaf1706ede8fb293b` | new; imports meetingParticipantAccess |
| 06 | `_shared/recordingConsent.ts` | H, I | none | `eb55e18f64d64443aeacf65bb4ec00dfea6f4a2bca6a53d1d7f170721fd0a8be` | new |
| 07 | `_shared/meetingContextAccess.ts` | I | none | `968cffd00c61377fede4dde150298a127e028e3304021287adb78ab7ec8e727f` | new |
| 08 | `_shared/webhookFreshness.ts` | G | none | `3c045d7ab2dc778ecfae0ac97f767ce78601347cfbdac2d2706a6fd9e7885411` | new |
| 09 | `_shared/shareLinkScope.ts` | J | none | `eb6eb1a0c7f19b083283cb3d18775c8db5362a3748b247627a0c9b213042c62d` | new |
| 10 | `_shared/purchaseEntitlement.ts` | K | none | `daed89fdad1f3d2260394b4ba3f5a5472ed8da0294d1c4a042cc632a6a831ed7` | new |
| 11 | `_shared/productFilePaths.ts` | K, M | none | `fd06fb87129fdd326c1d32fb296df212d28bdeb5bc0c24e2296049015bc0210b` | new; imported by get-download-urls, complete-product-purchase, stripe-marketplace-webhook |
| 12 | `_shared/studioAccess.ts` | L | projectAccess | `78191121643dbdd587330a61677b09f26c39b29c742ddf69018b0934822e1461` | new; imports projectAccess |
| 13 | `_shared/outboundText.ts` | N, P | none | `ae20433c5293e79164baa06ec3e154a53d4ed02fb07dd4c9ee35a56b3d628da0` | new |
| 14 | `_shared/getPaidLink.ts` | N | outboundText | `c72b65a22fa994322c16a64a5a1307b736bd26358a69ea39982bd58ba9b109c3` | new; imports outboundText |
| 15 | `_shared/guestVerification.ts` | N | outboundText | `52600f34eca8360b14f96e8f679d2124f9bcf2a02a3a4f4e6bfa873592ea08b3` | new; imports outboundText |
| 16 | `_shared/phoneOtp.ts` | P | none | `5aca7213c73f2171f1f7ac83556960ba1df1c16872672243bd669b747907a508` | new (only Web Crypto) |
| 17 | `_shared/agentDmBinding.ts` | Q | executionGuard | `a9c0e69b4836e9bcafc79b2f01a6972f8c23b1d3862d82fc4fb16799820cec64` | new; imports executionGuard |

## 5. Edge Functions (deploy one at a time, in this order)

For each: paste `supabase/functions/<function>/index.ts`, deploy that function, run the verification, watch the logs for 15 minutes, then the next. Rollback of any function: **re-paste `<function>__before.ts` and redeploy that function**. Helpers stay.

| # | Step | Function | PRs | Imports from `_shared` | SHA-256 |
|---|---|---|---|---|---|
| 18 | E | `mint-meeting-token` | #142 | meetingParticipantAccess, roomSessionLimits | `63bd589476d440ae084e5c72b60bbec74c78477c6f3d1121cf05acc7208f643e` |
| 19 | F | `get-recording-link` | #143, #149, #151, #152 | projectAccess, recordingAccess | `11ca0d25592205a7a593ae17536276a47bac33fc24f34925a0c01e1978ce5b2b` |
| 20 | H | `book-meeting` | #145, #152 | recordingConsent | `45d2b2de5865a883af9b579d415e6230e81520510579d29ca523eebc7da5ab56` |
| 21 | I | `create-meeting` | #146, #152 | meetingContextAccess, projectAccess, recordingConsent, roomSessionLimits | `c8387501dd8f3071e8b26ee2dd232d7e35bfd7cfaa7ade55cf47e1ebd35bf12b` |
| 22 | G | `daily-recording-webhook` | #144 | webhookFreshness | `f2795873808140b6d06a1b2d778b19e2682d32f0eb44593dfb78be6f9d77ff04` |
| 23 | J | `redeem-project-share` | #156 | shareLinkScope | `f8da3a1b8ab343849fbdb25bc53b307ac9f15d5a46556e65da84c49a8c263de8` |
| 24 | K | `get-download-urls` | #157, #159 | productFilePaths, purchaseEntitlement, stripeEnv | `7bc97fe857ddc0bb49757edce35a1e2a7a50cb1757fd9227d5fcc1d5c8786a27` |
| 25 | K | `complete-product-purchase` | #157, #159 | productFilePaths, purchaseEntitlement, stripeEnv | `62eeb74d0593dda123fe3d7ed7e1981f653275f4158fda10354d9e5b9296c08b` |
| 26 | K | `generate-studio-image` | #157 | aiModels, projectAccess, studioAIGate | `90ae0b16673f8bfb0778ceae0e0644698fe6f23f863abe8a863e878a55211058` |
| 27 | K | `generate-deal-memo` | #157 | none | `a3a5aa714c1261ea119ec2a4a181589377935d5b4a57edf2417c58234083e58f` |
| 28 | L | `generate-moodboard-image` | #158 | aiModels, studioAccess | `aa42f35f6842fb79f9341c70217bc224e66a8b169b1fab264cc226adb45dfbd8` |
| 29 | L | `generate-studio-copy` | #158 | aiModels, studioAIGate, studioAccess | `31fa73a68eca9c0855085fa9c963b16ab5cd6ec9fe845e5f173e9977e01261cc` |
| 30 | L | `studio-ingest` | #158 | aiModels, aiRateLimit, promptIsolation, studioAccess | `45cbf09c795da0ec7ebfb430e09819d9f12fc41177deb9892db21da0ca218a4e` |
| 31 | L | `match-event-guests` | #158 | aiModels, aiRateLimit, studioAccess | `edaf70396fbfdcefc297a31ea336d49b81c884a3df25e49aacc400ff6515bc9f` |
| 32 | M | `stripe-marketplace-webhook` | #159 | milestoneProjectSync, productFilePaths, resolveMilestonePayee, stripeEnv | `ea568dcfcaf4d5f128149cac7993edbf92ebfbebac9f1a21469309bed0b42a01` |
| 33 | N | `send-activity-digest` | #161 | admin-guard | `9a4a549e4dbc0cea09c90ee56b34e55ccd7f9e3c29c8c5bbc1b3adb3bd139231` |
| 34 | N | `send-streak-warning` | #161 | admin-guard | `71a8d8ad64ea5355595720735bfacc86bf063b938acef92fcacc67593078f176` |
| 35 | N | `send-reengagement` | #161 | admin-guard | `1bd3ce6f4bcd3c43f4e64e41df871a547c5230dbb64e8cb1bbd2e567abb778c0` |
| 36 | N | `send-get-paid-link` | #161 | getPaidLink, outboundText, projectAccess | `b3ecb55cf9d25b6a31e34023989428ac195a894c57ab476f9308fed2fdf21f77` |
| 37 | N | `verify-guest-opportunity` | #161 | guestVerification, outboundText | `ea2603c80e96d96769e96a69388f0fc61585a4d1fa69df40bb1eb70e03069614` |
| 38 | P | `send-phone-otp` | #162 | phoneOtp | `3a1334b2f27e8a6b0f4017e8a81d3a9c5bb7e007e0df02945268fc8c0d812e89` |
| 39 | P | `merge-accounts-init` | #162 | phoneOtp | `131286ca7d7b01bf87d19a496a2fa8c2100d62d26cc2eac4b8097732450df9fa` |
| 40 | P | `send-outreach-email` | #162 | aiModels, outboundText | `02d53136518c4ca0503bcca56064bbf48fca9eab2ac52e61f15b6c9401e0cacd` |
| 41 | P | `verify-brand-credit` | #162 | outboundText | `49dbc26a1cc01cbdd5063243fe43b9cd660fc51169c4e9a3475164eb17f93130` |
| 42 | Q | `agent-send-dm` | #163 (open) | agentDmBinding | `b207e5c82e4f03b2f9bd299a9c24abd970adfa02e366a5194fcb1bdd1d43dead` |

`get-download-urls` and `complete-product-purchase` appear once, at step K: the file pasted there already carries the step M change (product file path ownership), so step M adds only `stripe-marketplace-webhook`.

### Verification per function

**E `mint-meeting-token`**
- Host: 200. Invited participant: 200.
- The same participant after the host sets them `removed`: **403**. Unrelated user: **403**.
- Function logs show no import error (the `roomSessionLimits` dependency).

**F `get-recording-link`**
- Project call: owner, accepted collaborator, accepted creative: **200**.
- Accepted client listed as a call participant: **200**; not listed: **403**.
- Guest, pending invitee, `denied`, `removed`: **403**.

**H `book-meeting`**
- Booking with `record_consent: true`: `recording_enabled: true`; `false` or omitted: `recording_enabled: false`.
- The host notification still arrives (this version also fixes the `body` key of the notification insert).

**I `create-meeting`**
- Meeting from your own project: **200**; from a project you do not belong to: **403** and no new Daily room.
- Meeting in your own Circle: **200**; in a Circle you did not create or join: **403**.
- No `record_consent` in the request: `recording_enabled = false` and `transcript_enabled = false`.
- Logs: any 403 on a normal flow means a path was missed: roll back and report.

**G `daily-recording-webhook`**
- Daily dashboard test event: **200**. A fresh recording event: **200**, a transcript row is created.
- Replay of the same signed request after 900 s: **401**.

**J `redeem-project-share`**
- Folder link: approve a file or deliverable outside the folder: **403**; inside: 200.
- Deliverable link: another deliverable or a file of another deliverable: **403**; its own: 200.
- Project link: unchanged. Revoked or expired token: 410 as before.

**K `get-download-urls`**
- Buyer with a completed order: 200 with signed URLs. Refunded, pending or disputed order: **403**.
- A `digital_product_purchases` row the buyer wrote themselves, without a confirmed payment: **403**.
- A product whose `file_urls` names another seller's folder: the foreign path is skipped, no URL for it.

**K `complete-product-purchase`**
- A session paid for product A used with product B: **403**. The session of this product by this user: 200 or the existing order.

**K `generate-studio-image`**
- Accepted creative or owner: 200. Pending invitee, accepted guest or client: **403**.

**K `generate-deal-memo`**
- Poster generates a memo: 200 with a link that expires in one hour (was seven days).

**L `generate-moodboard-image`**
- Owner or accepted creative: 200. Pending, guest, client, unrelated: **403**.

**L `generate-studio-copy`**
- Same matrix as above; 403 before any quota is spent.

**L `studio-ingest`**
- Same matrix; no `studio_facts` row is written on a refusal.

**L `match-event-guests`**
- Host or accepted operator of the event's project: 200. Pending, guest, client: **403**.

**M `stripe-marketplace-webhook`**
- A digital purchase order is still created; only the paths inside the seller's folder are signed. Payment, status and fee fields are unchanged.

**N `send-activity-digest`**
- With only the anon key: **401**. With `x-cron-secret`: 200. Check the cron job first (see gates).

**N `send-streak-warning`**
- Same as above.

**N `send-reengagement`**
- Same as above.

**N `send-get-paid-link`**
- Project owner, valid address: 200. Accepted client, unrelated user, or no `projectId`: **403 / 403 / 400**, no mail.
- A message containing markup renders as text.

**N `verify-guest-opportunity`**
- Four verification requests for one address in an hour: 200, 200, 200, **429**.

**P `send-phone-otp`**
- Two sends within a minute: 200 then **429** with `Retry-After`.
- Five wrong codes: 400 x4 then **429**; the code is then invalid.
- A code for a new number clears `phone_verified` until confirmed.

**P `merge-accounts-init`**
- Fourth request in an hour: **429**. While no `account-merge-otp` template exists: **503**, the row is `failed`, no code in the logs.

**P `send-outreach-email`**
- `send_sequence` for a sequence pointing at another user's lead: no recipient, no mail, no write.

**P `verify-brand-credit`**
- A brand request with an invalid address: 400. Names are escaped in the mail.

**Q `agent-send-dm`**
- Approved action, exact recipient and text: **200**, one message, action `executed`. Same request again: **409**.
- Another recipient or another text: **403**. Another user's action: **403**. 31 minutes after approval: **410**.
- The in-app approval flow (approve, edit then approve, bundle kickoff DM) still sends.

## 6. Order of work in one session

1. Section 3 pre-checks.
2. Paste every helper of section 4 (no deploy needed).
3. Functions in this order: E, F, H, G, J, K (4 functions), L (4), M, N (after the cron check), P (4), Q. Step I last, and only when the `StartMeetingDialog` decision is made.
4. After the last step, fill the deployment record of `security-slices-e-to-i-manual-deployment-checklist.md` section 6 and the table below, and keep the `__before.ts` copies for the first full day of logs.

| Step | Function | Pasted by / when | Checksum matched | Verified | Logs reviewed | State |
|---|---|---|---|---|---|---|
| E | `mint-meeting-token` | | | | | not deployed |
| F | `get-recording-link` | | | | | not deployed |
| H | `book-meeting` | | | | | not deployed |
| I | `create-meeting` | | | | | not deployed |
| G | `daily-recording-webhook` | | | | | not deployed |
| J | `redeem-project-share` | | | | | not deployed |
| K | `get-download-urls` | | | | | not deployed |
| K | `complete-product-purchase` | | | | | not deployed |
| K | `generate-studio-image` | | | | | not deployed |
| K | `generate-deal-memo` | | | | | not deployed |
| L | `generate-moodboard-image` | | | | | not deployed |
| L | `generate-studio-copy` | | | | | not deployed |
| L | `studio-ingest` | | | | | not deployed |
| L | `match-event-guests` | | | | | not deployed |
| M | `stripe-marketplace-webhook` | | | | | not deployed |
| N | `send-activity-digest` | | | | | not deployed |
| N | `send-streak-warning` | | | | | not deployed |
| N | `send-reengagement` | | | | | not deployed |
| N | `send-get-paid-link` | | | | | not deployed |
| N | `verify-guest-opportunity` | | | | | not deployed |
| P | `send-phone-otp` | | | | | not deployed |
| P | `merge-accounts-init` | | | | | not deployed |
| P | `send-outreach-email` | | | | | not deployed |
| P | `verify-brand-credit` | | | | | not deployed |
| Q | `agent-send-dm` | | | | | not deployed |

## 7. What this bundle does not change

No SQL, no migration, no policy, no storage change, no cron change, no secret. M-A to M-E and the commerce proposal stay proposals until approved. The merge-accounts delivery template, the durable send registry, credential storage and Twilio spend controls are proposals (separate documents).
