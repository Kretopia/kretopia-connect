# Security deployment bundle, steps E to AG (manual paste into `kretopia-app`)

Source: `Kretopia/kretopia-connect` `main` at `016c00241` (PRs #142 to #179 merged, then docs PRs). Steps Z, AA, AB, AC, AD, AE, AF and AG come from their PR branches while those PRs are open (#184, #185, #187, #190, #193, #194, #195, #196, #197): their checksums change if the PRs do. Every checksum below is of the file at that ref; recompute after any later merge that touches these paths (`git show main:<path> | shasum -a 256`).

This is the single canonical deployment document. It supersedes `security-deployment-bundle-e-to-q.md` (PRs #164, #168, #173) and every earlier per-step list. **Nothing here is deployed.** Merged is not deployed: production runs the pre-slice copies. The document deploys nothing and contains no SQL.

A local, untracked copy of every file, numbered in paste order, with `SHA256SUMS` and `INDEX.txt`, is in `deploy-bundle-e-to-ag/` in the working tree of the session that generated this document (not committed).

Step letters follow the program: E to U are as in earlier documents, **V** (recording opt-in in two clients) is frontend only and has no file to paste, **W** is stages, **X** is the invitation list, **Y** is the fifth sender pass, **Z** is ThriveFund (finalizer and pledge request, owner-approved 2026-10-15) **AA** is the invoice provider reference (a migration the owner applies, then the webhook) **AB** is the event promo-code use limit, **AC** is the event ticket confirmation (a paid order is counted once) **AD** is the legacy untiered ticket purchase (one live purchase per buyer), **AE** is the wallet transfer input checks, **AF** is the batch milestone payout and **AG** is the milestone payment session. The order of pasting is E F H G J K L M N P Q R S T U W X Y Z AA AB AC AD AE AF AG and **I last**: step I is gated (section 2), so it does not sit between H and G as the step letters would suggest.

## 1. Merged is not deployed

| PR | Step | What | Artefact | GitHub | Deployed to `kretopia-app` / published |
|---|---|---|---|---|---|
| #142 | E | a denied or removed participant no longer gets a meeting token | function | merged 2026-10-13 | **no** |
| #143 | F | the recording link follows the call's participants | function | merged 2026-10-13 | **no** |
| #144 | G | the Daily recording webhook bounds the age of a signed request | function | merged 2026-10-13 | **no** |
| #145 | H | recording consent on a booking is explicit | function | merged 2026-10-13 | **no** |
| #146 | I | a meeting can only be attached to a project or circle you belong to | function | merged 2026-10-13 | **no** |
| #149 | F | a project call's recording is for the call's people | function | merged 2026-10-13 | **no** |
| #151 | F | accepted clients may fetch their project's recordings | function | merged 2026-10-13 | **no** |
| #152 | F, I | a project client sees only the calls they are listed on; consent defaults in create-meeting | function | merged 2026-10-13 | **no** |
| #155 | - | Landing: Passport and Match videos | frontend | merged 2026-10-13 | **no** |
| #156 | J | an approval stays inside the review link's scope | function | merged 2026-10-13 | **no** |
| #157 | K | files are issued only against proven entitlement | functions | merged 2026-10-13 | **no** |
| #158 | L | generators and ingest require an accepted member | functions | merged 2026-10-13 | **no** |
| #159 | K, M | sign only product files inside the seller's folder | functions | merged 2026-10-14 | **no** |
| #161 | N | no unauthenticated bulk send, no open payment-mail relay | functions | merged 2026-10-14 | **no** |
| #162 | P | phone codes rate and guess limited, outreach lead scoping | functions | merged 2026-10-14 | **no** |
| #163 | Q | an approved agent DM covers exactly one recipient and text, once | function | merged 2026-10-14 | **no** |
| #165 | R | event blast audience, invitation and outreach budgets | functions | merged 2026-10-14 | **no** |
| #167 | - | outreach screens stop loading the Gmail app password | frontend | merged 2026-10-14 | **no** |
| #169 | U | Studio routing free of AI credits | function + frontend | merged 2026-10-14 | **no** |
| #170 | T | Premium kick-off switch | functions + frontend | merged 2026-10-14 | **no** |
| #172 | S | an approval to delete or send covers that target, once | functions | merged 2026-10-14 | **no** |
| #174 | - | Hero: Waving palette, CTAs, search | frontend | merged 2026-10-14 | **no** |
| #175 | V | recording and transcription are opt-in in the two clients that start them | frontend only | merged 2026-10-14 | **no** |
| #176 | W | a curated stage records only when its host chose it; notice before joining | function + frontend | merged 2026-10-14 | **no** |
| #177 | - | Hero: Waving in HD from the official render | frontend | merged 2026-10-14 | **no** |
| #178 | X | an event invitation list is bounded per account and per address | function + helper + frontend | merged 2026-10-14 | **no** |
| #179 | Y | invoice reminders and swipe / session notifications happen once | functions + helper + frontend | merged 2026-10-14 | **no** |
| #184 | Z | ThriveFund: the finalizer decides the goal from verified authorisations (owner-approved option B) | function + helper | merged 2026-10-15 | **no** |
| #185 | Z | ThriveFund: a pledge request is bounded, single and checked (owner-approved option C) | function + helper | merged 2026-10-15 | **no** |
| #187 | AA | invoices: a provider reference, an honest label, a closed INSERT path | function + frontend + migration file | merged 2026-10-15 | **no** |
| #190 | AB | an event promo code's use limit holds under concurrent checkouts | function + helper | merged 2026-10-15 | **no** |
| #193 | AC | a paid event ticket order is counted once at confirmation | function + helper | open | **no** |
| #194 | AD | one live legacy ticket purchase per buyer; none for a cancelled event | function + helper | open | **no** |
| #195 | AE | a wallet transfer is whole cents and a currency label cannot open a new limit | function + helper | open | **no** |
| #196 | AF | batch milestone payout binds to the payer; no checkout nothing reconciles | function + helper + frontend | open | **no** |
| #197 | AG | a funded milestone is not paid twice; project and title come from the row | function + helper | open | **no** |

Docs-only PRs (nothing to deploy): #141 (merged 2026-10-13), #147 (merged 2026-10-13), #148 (merged 2026-10-13), #150 (merged 2026-10-13), #153 (merged 2026-10-13), #154 (merged 2026-10-13), #160 (merged 2026-10-14), #164 (merged 2026-10-14), #166 (merged 2026-10-14), #168 (merged 2026-10-14), #173 (merged 2026-10-14), #180 (merged 2026-10-14), #181 (merged 2026-10-14), #182 (merged 2026-10-15), #183 (merged 2026-10-15), #186 (merged 2026-10-15). #189 adds an inert helper (`_shared/orgAccess.ts`) that no function imports yet: nothing to deploy.

Frontend-only or frontend-carrying PRs ship on **one frontend publish** (not a paste): #155, #167, #169, #170, #174, #175, #176, #177, #178, #179, #187, #196. Publish **before** pasting step I (step I depends on #175).

## 2. Gates: what can be pasted when

| Class | Steps | Condition |
|---|---|---|
| Deployable without preflight | E, F, G, J, K, L, P, Q, R, S, T, U, W, X, Y, Z, AB, AC, AD, AE, AF, AG | the pre-checks of section 3 only. R, X and Y write rows to `email_send_log`, which the transactional sender already uses: confirm the table exists. T is a product decision already taken by the owner (the Premium kick-off switch) |
| Deployable after one check | N | any scheduled job that calls `send-activity-digest`, `send-streak-warning` or `send-reengagement` must send `x-cron-secret` first, or its next run answers 401 (`cron.job` cannot be listed from the repository) |
| Product decision taken | H (consent default), V | #175 made recording and transcription opt-in in the dialog and unticked in the booking box. Frontend publish required |
| **Released by the owner (2026-10-15)** | **I** | the Circle and project preflights are accepted as captured on 2026-10-13; the technical prerequisites of section 2b remain |
| **SQL first, then paste** | **AA** (with step M's file) | the invoices migration (section 8) is applied by the owner; then the webhook; then the frontend. The webhook of step M is no longer pasted separately: its file is pasted once, at AA |
| Approved by the owner 2026-10-15 | Z | options B and C of the ThriveFund proposal. **Paste `thrivefund-finalize-campaign` before any finalization runs** |
| Blocked by M-A | none of E to Y | no step of this bundle depends on the SQL of M-A. M-A itself is blocked: section 8 |
| Blocked by a migration | ThriveFund option A | `proposal-thrivefund-pending-pledge-state.md` (PR #186): a new `capture_status` value, a webhook and a Stripe endpoint with its secret |
| Product decision still open | P `merge-accounts-init` | merging accounts stays unavailable: no delivery template (`proposal-account-merge-otp-template.md`) |

### 2b. Step I (`create-meeting`)

**Released by the owner on 2026-10-15.** The owner accepted the 2026-10-13 capture (Circle A1 0 rows, A2 `circle_meetings = 0`, `circle_hosts = 0`, `circle_meetings_90d = 0`, project A3 0 rows) as the preflight: it is a GO on an **empty population** (no meeting has ever had a `circle_id`, and no project-meeting denominator was captured), so it shows the gate does not break existing meetings, not that the Circle branch works; the first real Circle meeting after the paste is the only evidence. That is a decision, recorded here, not new evidence.

What does not go away, because it is a fact and not a permission:

1. **The frontend of #175 must be published first.** Otherwise the dialog sends no `record_consent` and recording silently stops.
2. `_shared/roomSessionLimits.ts` and `_shared/meetingContextAccess.ts` are pasted (section 4).
3. Watch the logs: any 403 on a normal flow means a path was missed: roll back and report.

## 3. Pre-checks, before the first paste

1. In `kretopia-app`, save the **currently deployed copy of every file listed in sections 4 and 5** that already exists there, named `<file>__before.ts` (the rollback artefact). A helper marked *new* has no copy to save.
2. Confirm these existing shared files are present (the bundle imports them and does not replace them):

| Existing file | Needed by |
|---|---|
| `_shared/admin-guard.ts` | `send-activity-digest`, `send-reengagement`, `send-streak-warning`, `thrivefund-finalize-campaign` |
| `_shared/aiModels.ts` | `desk-agent`, `desk-ai`, `generate-moodboard-image`, `generate-studio-copy`, `generate-studio-image`, `match-event-guests`, `route-studio-outcome`, `scout-gigs`, `send-invoice-chase`, `send-outreach-email`, `studio-ingest`, `thrive-ai-chat`, `thrive-voice-turn` |
| `_shared/aiRateLimit.ts` | `match-event-guests`, `scout-gigs`, `studio-ingest` |
| `_shared/copilotContext.ts` | `desk-agent`, `desk-ai`, `thrive-ai-chat` |
| `_shared/embed.ts` | `thrive-ai-chat` |
| `_shared/escrowAuth.ts` | `batch-milestone-payout` |
| `_shared/fetchWithTimeout.ts` | `desk-agent`, `desk-ai`, `thrive-ai-chat` |
| `_shared/milestoneProjectSync.ts` | `stripe-marketplace-webhook` |
| `_shared/platformFees.ts` | `create-milestone-payment` |
| `_shared/promptIsolation.ts` | `studio-ingest` |
| `_shared/resolveMilestonePayee.ts` | `batch-milestone-payout`, `create-milestone-payment`, `stripe-marketplace-webhook` |
| `_shared/scoutSources.ts` | `scout-gigs` |
| `_shared/stripeEnv.ts` | `batch-milestone-payout`, `checkout-event-tickets`, `complete-product-purchase`, `create-milestone-payment`, `get-download-urls`, `purchase-event-ticket`, `stripe-marketplace-webhook`, `thrivefund-create-pledge`, `thrivefund-finalize-campaign`, `verify-event-ticket` |

3. Confirm secrets are present (presence only): `DAILY_API_KEY`, `DAILY_WEBHOOK_HMAC_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY` (or the mode-specific keys), `RESEND_API_KEY`, `TWILIO_*` for `send-phone-otp`, `CRON_SECRET`.
4. Name the person who watches the function logs for the first 15 minutes after each deploy.
5. Integrity: in `deploy-bundle-e-to-ag/`, `shasum -a 256 -c SHA256SUMS` prints OK for every file.

## 4. Shared helpers (paste all of these first, importers after the files they import)

A helper is imported by functions; it is not an Edge Function and is not deployed on its own. Pasting a helper changes nothing until a function that imports it is deployed. **Rollback of a helper:** none needed for a *new* one (the old code does not import it); for an *existing* one, re-paste `<file>__before.ts`, but only after re-pasting the importing functions' `__before` copies.

| # | Source repo path = destination path in `kretopia-app` | In kretopia-app | Imports | Needed by steps | SHA-256 | Note |
|---|---|---|---|---|---|---|
| 01 | `supabase/functions/_shared/roomSessionLimits.ts` | new | none | E, I | `f2aa42fe244c9659555bc10953a675ef7df51019a6d535816553c951a3a5961a` | ABSENT in kretopia-app (HTTP 404 on 2026-10-13): mint-meeting-token and create-meeting fail to start without it |
| 02 | `supabase/functions/_shared/meetingParticipantAccess.ts` | new | none | E, F | `f2dc1c33ed6a0faea0a5b2d85bbb320254c9e0b65a847d0886017976da863364` |  |
| 03 | `supabase/functions/_shared/projectAccess.ts` | existing: equivalent on 2026-10-13, compare the SHA-256 and paste only if it differs | none | F, K, L, N, R, T, I | `0a0b3cb8b1dabcf1c5628f5464c9ad714f1f85e7a968f3450a3ef91867b4a092` |  |
| 04 | `supabase/functions/_shared/executionGuard.ts` | existing: compare the SHA-256 and paste only if absent or different | none | Q, S, T | `1bf3559a6e4beda1d5da597c5764b7811ad9cbb505a17cac708ff82850aa0fb3` |  |
| 05 | `supabase/functions/_shared/recordingAccess.ts` | new | meetingParticipantAccess | F | `204705a2593ba496956dccf9d4ed4d45e215d4ad2f64934eaf1706ede8fb293b` | imports meetingParticipantAccess |
| 06 | `supabase/functions/_shared/recordingConsent.ts` | new | none | H, I | `eb55e18f64d64443aeacf65bb4ec00dfea6f4a2bca6a53d1d7f170721fd0a8be` |  |
| 07 | `supabase/functions/_shared/meetingContextAccess.ts` | new | none | I | `968cffd00c61377fede4dde150298a127e028e3304021287adb78ab7ec8e727f` |  |
| 08 | `supabase/functions/_shared/webhookFreshness.ts` | new | none | G | `3c045d7ab2dc778ecfae0ac97f767ce78601347cfbdac2d2706a6fd9e7885411` |  |
| 09 | `supabase/functions/_shared/shareLinkScope.ts` | new | none | J | `eb6eb1a0c7f19b083283cb3d18775c8db5362a3748b247627a0c9b213042c62d` |  |
| 10 | `supabase/functions/_shared/purchaseEntitlement.ts` | new | none | K | `daed89fdad1f3d2260394b4ba3f5a5472ed8da0294d1c4a042cc632a6a831ed7` |  |
| 11 | `supabase/functions/_shared/productFilePaths.ts` | new | none | K, AA | `fd06fb87129fdd326c1d32fb296df212d28bdeb5bc0c24e2296049015bc0210b` |  |
| 12 | `supabase/functions/_shared/studioAccess.ts` | new | projectAccess | L | `9053f46f9b9e071e4e48d87ea5a59d0194424f795551b91c3cdb2632de1790df` | imports projectAccess |
| 13 | `supabase/functions/_shared/outboundText.ts` | new | none | N, P, R, S, X, Y | `ae20433c5293e79164baa06ec3e154a53d4ed02fb07dd4c9ee35a56b3d628da0` |  |
| 14 | `supabase/functions/_shared/getPaidLink.ts` | new | outboundText | N | `d04fcd7c4916fd0fd3094b3396623a223acce913cfffddf5096d462e54a03e17` | imports outboundText |
| 15 | `supabase/functions/_shared/guestVerification.ts` | new | outboundText | N | `52600f34eca8360b14f96e8f679d2124f9bcf2a02a3a4f4e6bfa873592ea08b3` | imports outboundText |
| 16 | `supabase/functions/_shared/phoneOtp.ts` | new | none | P | `5aca7213c73f2171f1f7ac83556960ba1df1c16872672243bd669b747907a508` | only Web Crypto |
| 17 | `supabase/functions/_shared/outboundBudget.ts` | new | none | P, R, X, Y | `9c2b2e75a26771d88728bce6df14beeb905cd8cdd0c2badf2d2447a6d0c4bc76` | one file for steps R, X and Y: this is the step X version (bulk planning added); uses `email_send_log` |
| 18 | `supabase/functions/_shared/agentDmBinding.ts` | new | executionGuard | Q | `4939a62cacd0d35125a592d0341468d485d4060cf83f1dddb5f864cbfdb7f7ca` | imports executionGuard |
| 19 | `supabase/functions/_shared/agentActionBinding.ts` | new | executionGuard | S | `0638e8883cb1a69ab3a10c64173be1a12378fe7ccbcdc5dcc85aae44c1f49d09` | imports executionGuard |
| 20 | `supabase/functions/_shared/agentAuthority.ts` | existing, MODIFIED: paste it, the old copy ignores `targets` | agentActionBinding | S | `4b52cca456b2827a8b74ab51d0bbcec1077e3bf58e7e565c9cb0cbbf933b3fc1` | imports agentActionBinding |
| 21 | `supabase/functions/_shared/premiumSwitch.ts` | new | none | K, L, T | `f4e372d193fb9cd5d18cb772e5f4cfdbdc10f88a7f3c22e29e503ba5caaa1375` | `PREMIUM_ENFORCED = false`, the Premium kick-off switch |
| 22 | `supabase/functions/_shared/studioAIGate.ts` | existing, MODIFIED: paste it; imports premiumSwitch | premiumSwitch | K, L | `9832c908fe44950ce60389ad22eca52008ae68430e8970f3c901c09984b07b65` |  |
| 23 | `supabase/functions/_shared/studioOutcomeRouter.ts` | new | none | U | `e216b5b101422b472d5616b5a340484847c91c72ad0537cfd4d8c7baa88775e2` | the rule router of "Tell Kreto what you need" |
| 24 | `supabase/functions/_shared/notificationGuards.ts` | new | outboundText | S, Y | `6366dc97e614f1cff886c8919a635d2492b86c3418efb4c89da14915a897b160` | step Y (PR #179); imports outboundText |
| 25 | `supabase/functions/_shared/pledgeVerification.ts` | new | none | Z | `5a4fb1c2bf8626b7a84be4c3707dac242a997b3d5762ce4cfca02e93db88fca5` | step Z (PR #184, ThriveFund finalizer, owner-approved option B) |
| 26 | `supabase/functions/_shared/pledgeRequest.ts` | new | none | Z | `75e4f02a04f39b897f8ceee401529b18abb9a52e8010b891a578abc3b089cba3` | step Z (PR #185, ThriveFund pledge request limits, owner-approved option C) |
| 27 | `supabase/functions/_shared/ticketCheckout.ts` | new | none | AB | `fa6d5e65ffb3758712701d198b226b8846ef98790437db75a3e464964b8210ee` | step AB (PR #190, event promo-code use limit); no import |
| 28 | `supabase/functions/_shared/orderConfirmation.ts` | new | none | AC | `d7a054c79ecc8b9b94e778cad3f5cf640ae5d47f037d3ca77f96c6bf2b020878` | step AC (PR #193, event ticket confirmation); no import |
| 29 | `supabase/functions/_shared/ticketPurchase.ts` | new | none | AD | `63c1942f2d2744db7cdab1ceaf1aa9e49553e9e32549f727815396995f215a60` | step AD (PR #194, legacy ticket purchase); no import |
| 30 | `supabase/functions/_shared/walletTransfer.ts` | new | none | AE | `2e57fdcde37e4661e499f0b68801afe9c709fc30aa89d17d09c5e8bd0f254234` | step AE (PR #195, wallet transfer input checks); no import |
| 31 | `supabase/functions/_shared/batchPayout.ts` | new | none | AF | `453bc41555119d33480e048a28d0ce6446c56e8418967e2b82c3a709500b280f` | step AF (PR #196, batch milestone payout); no import |
| 32 | `supabase/functions/_shared/milestonePayable.ts` | new | none | AG | `356b516c7f10c425200018e14944f3d1f14ec54b588e69bb0bf92f43b92854c4` | step AG (PR #197, milestone payment session); no import |

## 5. Edge Functions (deploy one at a time, in this order)

For each: paste `supabase/functions/<function>/index.ts`, deploy that function, run its verification (section 6), watch the logs for 15 minutes, then the next. **Rollback of any function:** re-paste `<function>__before.ts` (the copy saved in section 3) and redeploy that function. Helpers stay.

| # | Step | Source repo path = destination path | PRs | Imports from `_shared` | SHA-256 | Rollback artefact to save first |
|---|---|---|---|---|---|---|
| 33 | E | `supabase/functions/mint-meeting-token/index.ts` | #142 | meetingParticipantAccess, roomSessionLimits | `63bd589476d440ae084e5c72b60bbec74c78477c6f3d1121cf05acc7208f643e` | `mint-meeting-token__before.ts` |
| 34 | F | `supabase/functions/get-recording-link/index.ts` | #143, #149, #151, #152 | projectAccess, recordingAccess | `11ca0d25592205a7a593ae17536276a47bac33fc24f34925a0c01e1978ce5b2b` | `get-recording-link__before.ts` |
| 35 | H | `supabase/functions/book-meeting/index.ts` | #145, #152 | recordingConsent | `45d2b2de5865a883af9b579d415e6230e81520510579d29ca523eebc7da5ab56` | `book-meeting__before.ts` |
| 36 | G | `supabase/functions/daily-recording-webhook/index.ts` | #144 | webhookFreshness | `f2795873808140b6d06a1b2d778b19e2682d32f0eb44593dfb78be6f9d77ff04` | `daily-recording-webhook__before.ts` |
| 37 | J | `supabase/functions/redeem-project-share/index.ts` | #156 | shareLinkScope | `f8da3a1b8ab343849fbdb25bc53b307ac9f15d5a46556e65da84c49a8c263de8` | `redeem-project-share__before.ts` |
| 38 | K | `supabase/functions/get-download-urls/index.ts` | #157, #159 | productFilePaths, purchaseEntitlement, stripeEnv | `7bc97fe857ddc0bb49757edce35a1e2a7a50cb1757fd9227d5fcc1d5c8786a27` | `get-download-urls__before.ts` |
| 39 | K | `supabase/functions/complete-product-purchase/index.ts` | #157, #159 | productFilePaths, purchaseEntitlement, stripeEnv | `62eeb74d0593dda123fe3d7ed7e1981f653275f4158fda10354d9e5b9296c08b` | `complete-product-purchase__before.ts` |
| 40 | K | `supabase/functions/generate-studio-image/index.ts` | #157 | aiModels, projectAccess, studioAIGate | `90ae0b16673f8bfb0778ceae0e0644698fe6f23f863abe8a863e878a55211058` | `generate-studio-image__before.ts` |
| 41 | K | `supabase/functions/generate-deal-memo/index.ts` | #157 | none | `a3a5aa714c1261ea119ec2a4a181589377935d5b4a57edf2417c58234083e58f` | `generate-deal-memo__before.ts` |
| 42 | L | `supabase/functions/generate-moodboard-image/index.ts` | #158 | aiModels, studioAccess | `aa42f35f6842fb79f9341c70217bc224e66a8b169b1fab264cc226adb45dfbd8` | `generate-moodboard-image__before.ts` |
| 43 | L | `supabase/functions/generate-studio-copy/index.ts` | #158 | aiModels, studioAIGate, studioAccess | `31fa73a68eca9c0855085fa9c963b16ab5cd6ec9fe845e5f173e9977e01261cc` | `generate-studio-copy__before.ts` |
| 44 | L | `supabase/functions/studio-ingest/index.ts` | #158 | aiModels, aiRateLimit, promptIsolation, studioAccess | `45cbf09c795da0ec7ebfb430e09819d9f12fc41177deb9892db21da0ca218a4e` | `studio-ingest__before.ts` |
| 45 | L | `supabase/functions/match-event-guests/index.ts` | #158 | aiModels, aiRateLimit, studioAccess | `edaf70396fbfdcefc297a31ea336d49b81c884a3df25e49aacc400ff6515bc9f` | `match-event-guests__before.ts` |
| 46 | N | `supabase/functions/send-activity-digest/index.ts` | #161 | admin-guard | `9a4a549e4dbc0cea09c90ee56b34e55ccd7f9e3c29c8c5bbc1b3adb3bd139231` | `send-activity-digest__before.ts` |
| 47 | N | `supabase/functions/send-streak-warning/index.ts` | #161 | admin-guard | `71a8d8ad64ea5355595720735bfacc86bf063b938acef92fcacc67593078f176` | `send-streak-warning__before.ts` |
| 48 | N | `supabase/functions/send-reengagement/index.ts` | #161 | admin-guard | `1bd3ce6f4bcd3c43f4e64e41df871a547c5230dbb64e8cb1bbd2e567abb778c0` | `send-reengagement__before.ts` |
| 49 | N | `supabase/functions/send-get-paid-link/index.ts` | #161 | getPaidLink, outboundText, projectAccess | `b3ecb55cf9d25b6a31e34023989428ac195a894c57ab476f9308fed2fdf21f77` | `send-get-paid-link__before.ts` |
| 50 | N | `supabase/functions/verify-guest-opportunity/index.ts` | #161 | guestVerification, outboundText | `ea2603c80e96d96769e96a69388f0fc61585a4d1fa69df40bb1eb70e03069614` | `verify-guest-opportunity__before.ts` |
| 51 | P | `supabase/functions/send-phone-otp/index.ts` | #162 | phoneOtp | `3a1334b2f27e8a6b0f4017e8a81d3a9c5bb7e007e0df02945268fc8c0d812e89` | `send-phone-otp__before.ts` |
| 52 | P | `supabase/functions/merge-accounts-init/index.ts` | #162 | phoneOtp | `131286ca7d7b01bf87d19a496a2fa8c2100d62d26cc2eac4b8097732450df9fa` | `merge-accounts-init__before.ts` |
| 53 | P | `supabase/functions/send-outreach-email/index.ts` | #162, #165 | aiModels, outboundBudget, outboundText | `0944a58f2ddf69abd90b60bdf2014e69728afb85e701ec3594e521f9e16eb149` | `send-outreach-email__before.ts` |
| 54 | P | `supabase/functions/verify-brand-credit/index.ts` | #162 | outboundText | `49dbc26a1cc01cbdd5063243fe43b9cd660fc51169c4e9a3475164eb17f93130` | `verify-brand-credit__before.ts` |
| 55 | Q | `supabase/functions/agent-send-dm/index.ts` | #163 | agentDmBinding | `b207e5c82e4f03b2f9bd299a9c24abd970adfa02e366a5194fcb1bdd1d43dead` | `agent-send-dm__before.ts` |
| 56 | R | `supabase/functions/send-project-invitation/index.ts` | #165 | outboundBudget, outboundText, projectAccess | `8f93947be6c5b003748c85400aef65930d99890e043c29895760939145b879af` | `send-project-invitation__before.ts` |
| 57 | R | `supabase/functions/send-event-blast/index.ts` | #165 | none | `1c757bb0fb795536727c934099685f5ee83e74a50a7be4136d17496cbb33a386` | `send-event-blast__before.ts` |
| 58 | R | `supabase/functions/send-credit-invite/index.ts` | #165 | outboundText | `2c6109d462732c2ecd1f00cfe460d92b6b3f54b169d131a69d2f8493913a8c36` | `send-credit-invite__before.ts` |
| 59 | S | `supabase/functions/copilot-collaborator-tools/index.ts` | #172 | agentAuthority | `74142ef4449f5714cc0e5f48f3aa2026fa961c28ecb8abd8c33101ddd988cb3e` | `copilot-collaborator-tools__before.ts` |
| 60 | S | `supabase/functions/send-outreach-draft/index.ts` | #172, #179 | agentActionBinding, notificationGuards | `702a04d8e829b56c2fccf701a281d9d211226442b96818d359bc1b43a8f3b83e` | `send-outreach-draft__before.ts` |
| 61 | T | `supabase/functions/desk-ai/index.ts` | #170 | aiModels, copilotContext, fetchWithTimeout, premiumSwitch, projectAccess | `8de853b2ae491f4186ee50dd559b5f747eef599228cb4a54837c79eaca1550a0` | `desk-ai__before.ts` |
| 62 | T | `supabase/functions/desk-agent/index.ts` | #170 | aiModels, copilotContext, executionGuard, fetchWithTimeout, premiumSwitch | `8c4758594174688fb9bb6be1ac1b155a9574380f00a4ba02480a7656ef8f852f` | `desk-agent__before.ts` |
| 63 | T | `supabase/functions/thrive-ai-chat/index.ts` | #170 | aiModels, copilotContext, embed, fetchWithTimeout, premiumSwitch | `65fa2f6ae3b10f9182bcac5aee6907b592534ff3545dc6357fb5c5804f065b4a` | `thrive-ai-chat__before.ts` |
| 64 | T | `supabase/functions/scout-gigs/index.ts` | #170 | aiModels, aiRateLimit, premiumSwitch, scoutSources | `11f082ec689bc1f9f8bee363c090b3b8d5bdcd449c3656072f06640e2bf402c9` | `scout-gigs__before.ts` |
| 65 | T | `supabase/functions/thrive-voice-turn/index.ts` | #170 | aiModels, premiumSwitch | `c9ca00e0c98c05ade854bb5923ea54d4f35cde6012c14529924e44cadaf6969a` | `thrive-voice-turn__before.ts` |
| 66 | U | `supabase/functions/route-studio-outcome/index.ts` | #169 | aiModels, studioOutcomeRouter | `acbae65675b3c67802e47e74540d2a2133cda27a1e44def6c339baef65075e98` | `route-studio-outcome__before.ts` |
| 67 | W | `supabase/functions/create-curated-stage/index.ts` | #176 | none | `f98219f0cee207353648820ca5e656ac4b47e8a88a51306ad5a5b7e8d9146730` | `create-curated-stage__before.ts` |
| 68 | X | `supabase/functions/send-event-invite/index.ts` | #178 | outboundBudget, outboundText | `935595b31dcbd4371282bc19fe487009150c3bfaf0954e81594e0c536cd58a35` | `send-event-invite__before.ts` |
| 69 | Y | `supabase/functions/send-invoice-chase/index.ts` | #179 | aiModels, notificationGuards | `12868b1d1d21b87aa877fd606c489895ce3b08edef9f8c33eb2c72a4cbfc1ca9` | `send-invoice-chase__before.ts` |
| 70 | Y | `supabase/functions/notify-swipe/index.ts` | #179 | notificationGuards, outboundBudget | `16a7377e1a50676d871f598b5d6e475d3b864940e11cd2dc265469926b17c339` | `notify-swipe__before.ts` |
| 71 | Y | `supabase/functions/notify-speed-pool-ping/index.ts` | #179 | notificationGuards | `f691aa03eda7fe85e9a74ee7af61a9efa86a987817fab18cc4acc7915961f421` | `notify-speed-pool-ping__before.ts` |
| 72 | Y | `supabase/functions/notify-speed-session-update/index.ts` | #179 | notificationGuards | `ac638dea60447773c56dea3007b4de482a6ebd9fc364aa85ab2c488169f8e6a0` | `notify-speed-session-update__before.ts` |
| 73 | Z | `supabase/functions/thrivefund-finalize-campaign/index.ts` | #184 | admin-guard, pledgeVerification, stripeEnv | `83a89ae47c151585879df0eb6a93150725ca54da8993fbeb709b6ea94878096e` | `thrivefund-finalize-campaign__before.ts` |
| 74 | Z | `supabase/functions/thrivefund-create-pledge/index.ts` | #185 | pledgeRequest, stripeEnv | `f96bc3459cdd9b5d6db14b8a9194f63ff3d3ba84a4b59557692046bd5927859f` | `thrivefund-create-pledge__before.ts` |
| 75 | AA | `supabase/functions/stripe-marketplace-webhook/index.ts` | #159, #187 | milestoneProjectSync, productFilePaths, resolveMilestonePayee, stripeEnv | `4ecc2417b1b2d0c685d21979608b02c41f380fc2bc52053407a000b3d7759148` | `stripe-marketplace-webhook__before.ts` |
| 76 | AB | `supabase/functions/checkout-event-tickets/index.ts` | #190 | stripeEnv, ticketCheckout | `8f6c0eac572b9210115852bbeacf5fca451814163e55c921ac518134974ca0b7` | `checkout-event-tickets__before.ts` |
| 77 | AC | `supabase/functions/verify-event-ticket/index.ts` | #193 | orderConfirmation, stripeEnv | `24493cb519157ede57c5281a6bb9f28cbf20137828c26a022427120da13918f5` | `verify-event-ticket__before.ts` |
| 78 | AD | `supabase/functions/purchase-event-ticket/index.ts` | #194 | stripeEnv, ticketPurchase | `257f7457ed1331373aa2b73e7bf9abed4a007debe0e3a2284cd864a3a4458e9a` | `purchase-event-ticket__before.ts` |
| 79 | AE | `supabase/functions/wallet-transfer/index.ts` | #195 | walletTransfer | `229ef4db8f43bfd0720679e5761820c25e28f9f3846d31a2fb9220274aded203` | `wallet-transfer__before.ts` |
| 80 | AF | `supabase/functions/batch-milestone-payout/index.ts` | #196 | batchPayout, escrowAuth, resolveMilestonePayee, stripeEnv | `a35d95a8a56d46ce1fd4dc9f7d423c198453bfe9dae057117eeb62295495c56a` | `batch-milestone-payout__before.ts` |
| 81 | AG | `supabase/functions/create-milestone-payment/index.ts` | #197 | milestonePayable, platformFees, resolveMilestonePayee, stripeEnv | `4562780e8e7f7c62246ed0a68db0b120b39875419c22274c05a164ad0a08b495` | `create-milestone-payment__before.ts` |
| 82 | I | `supabase/functions/create-meeting/index.ts` | #146, #152 | meetingContextAccess, projectAccess, recordingConsent, roomSessionLimits | `c8387501dd8f3071e8b26ee2dd232d7e35bfd7cfaa7ade55cf47e1ebd35bf12b` | `create-meeting__before.ts` |

Notes: `get-download-urls` and `complete-product-purchase` appear once, at step K; the file pasted there already carries the step M change. `send-outreach-draft` appears once, at step S; the file carries the step Y reminder rule (PR #179). `_shared/outboundBudget.ts` is one file for steps R, X and Y.

## 6. Verification per function

**E `mint-meeting-token`**
- Host: 200. Invited participant: 200.
- The same participant after the host sets them `removed`: **403**. Unrelated user: **403**.
- Function logs show no import error (the `roomSessionLimits` dependency).
- Rollback: re-paste `mint-meeting-token__before.ts`, redeploy `mint-meeting-token`.

**F `get-recording-link`**
- Project call: owner, accepted collaborator, accepted creative: **200**.
- Accepted client listed as a call participant: **200**; not listed: **403**.
- Guest, pending invitee, `denied`, `removed`: **403**.
- Rollback: re-paste `get-recording-link__before.ts`, redeploy `get-recording-link`.

**H `book-meeting`**
- Booking with `record_consent: true`: `recording_enabled: true`; `false` or omitted: `recording_enabled: false`.
- The host notification still arrives (this version also fixes the `body` key of the notification insert).
- Rollback: re-paste `book-meeting__before.ts`, redeploy `book-meeting`.

**G `daily-recording-webhook`**
- Daily dashboard test event: **200**. A fresh recording event: **200**, a transcript row is created.
- Replay of the same signed request after 900 s: **401**.
- Rollback: re-paste `daily-recording-webhook__before.ts`, redeploy `daily-recording-webhook`.

**J `redeem-project-share`**
- Folder link: approve a file or deliverable outside the folder: **403**; inside: 200.
- Deliverable link: another deliverable or a file of another deliverable: **403**; its own: 200.
- Project link: unchanged. Revoked or expired token: 410 as before.
- Rollback: re-paste `redeem-project-share__before.ts`, redeploy `redeem-project-share`.

**K `get-download-urls`**
- Buyer with a completed order: 200 with signed URLs. Refunded, pending or disputed order: **403**.
- A `digital_product_purchases` row the buyer wrote themselves, without a confirmed payment: **403**.
- A product whose `file_urls` names another seller's folder: the foreign path is skipped, no URL for it.
- Rollback: re-paste `get-download-urls__before.ts`, redeploy `get-download-urls`.

**K `complete-product-purchase`**
- A session paid for product A used with product B: **403**. The session of this product by this user: 200 or the existing order.
- Rollback: re-paste `complete-product-purchase__before.ts`, redeploy `complete-product-purchase`.

**K `generate-studio-image`**
- Accepted creative or owner: 200. Pending invitee, accepted guest or client: **403**.
- Rollback: re-paste `generate-studio-image__before.ts`, redeploy `generate-studio-image`.

**K `generate-deal-memo`**
- Poster generates a memo: 200 with a link that expires in one hour (was seven days).
- Rollback: re-paste `generate-deal-memo__before.ts`, redeploy `generate-deal-memo`.

**L `generate-moodboard-image`**
- Owner or accepted creative: 200. Pending, guest, client, unrelated: **403**.
- Rollback: re-paste `generate-moodboard-image__before.ts`, redeploy `generate-moodboard-image`.

**L `generate-studio-copy`**
- Same matrix; 403 before any quota is spent.
- Rollback: re-paste `generate-studio-copy__before.ts`, redeploy `generate-studio-copy`.

**L `studio-ingest`**
- Same matrix; no `studio_facts` row is written on a refusal.
- Rollback: re-paste `studio-ingest__before.ts`, redeploy `studio-ingest`.

**L `match-event-guests`**
- Host or accepted operator of the event's project: 200. Pending, guest, client: **403**.
- Rollback: re-paste `match-event-guests__before.ts`, redeploy `match-event-guests`.

**N `send-activity-digest`**
- With only the anon key: **401**. With `x-cron-secret`: 200. Check the cron job first (section 2).
- Rollback: re-paste `send-activity-digest__before.ts`, redeploy `send-activity-digest`.

**N `send-streak-warning`**
- Same as above.
- Rollback: re-paste `send-streak-warning__before.ts`, redeploy `send-streak-warning`.

**N `send-reengagement`**
- Same as above.
- Rollback: re-paste `send-reengagement__before.ts`, redeploy `send-reengagement`.

**N `send-get-paid-link`**
- Project owner, valid address: 200. Accepted client, unrelated user, or no `projectId`: **403 / 403 / 400**, no mail.
- A message containing markup renders as text.
- Rollback: re-paste `send-get-paid-link__before.ts`, redeploy `send-get-paid-link`.

**N `verify-guest-opportunity`**
- Four verification requests for one address in an hour: 200, 200, 200, **429**.
- Rollback: re-paste `verify-guest-opportunity__before.ts`, redeploy `verify-guest-opportunity`.

**P `send-phone-otp`**
- Two sends within a minute: 200 then **429** with `Retry-After`.
- Five wrong codes: 400 x4 then **429**; the code is then invalid.
- A code for a new number clears `phone_verified` until confirmed.
- Rollback: re-paste `send-phone-otp__before.ts`, redeploy `send-phone-otp`.

**P `merge-accounts-init`**
- Fourth request in an hour: **429**. While no `account-merge-otp` template exists: **503**, the row is `failed`, no code in the logs.
- Rollback: re-paste `merge-accounts-init__before.ts`, redeploy `merge-accounts-init`.

**P `send-outreach-email`**
- `send_sequence` for a sequence pointing at another user's lead: no recipient, no mail, no write.
- The same `sequenceEmailId` sent twice: 200 then **409**, one mail. Over 30 platform-domain mails in an hour: **429** (Gmail sends are not counted).
- Rollback: re-paste `send-outreach-email__before.ts`, redeploy `send-outreach-email`.

**P `verify-brand-credit`**
- A brand request with an invalid address: 400. Names are escaped in the mail.
- Rollback: re-paste `verify-brand-credit__before.ts`, redeploy `verify-brand-credit`.

**Q `agent-send-dm`**
- Approved action, exact recipient and text: **200**, one message, action `executed`. Same request again: **409**.
- Another recipient or another text: **403**. Another user's action: **403**. 31 minutes after approval: **410**.
- The in-app approval flow (approve, edit then approve, bundle kickoff DM) still sends.
- Rollback: re-paste `agent-send-dm__before.ts`, redeploy `agent-send-dm`.

**R `send-project-invitation`**
- Owner, 21st invitation in an hour, or a 4th to one address: **429**, no link minted, no account created. Accepted guest: **403**.
- Rollback: re-paste `send-project-invitation__before.ts`, redeploy `send-project-invitation`.

**R `send-event-blast`**
- A host's explicit `userIds` containing a user who is not on the event: that user is not mailed.
- Rollback: re-paste `send-event-blast__before.ts`, redeploy `send-event-blast`.

**R `send-credit-invite`**
- 25 collaborators in one request: the first 20 are processed; an invalid address is reported, not sent.
- Rollback: re-paste `send-credit-invite__before.ts`, redeploy `send-credit-invite`.

**S `copilot-collaborator-tools`**
- An approved delete_project action used for another project: **403**, the other project intact. The approved project: deleted once; a second use: **409**.
- The app's own Delete project button (no agent markers): unchanged.
- Rollback: re-paste `copilot-collaborator-tools__before.ts`, redeploy `copilot-collaborator-tools`.

**S `send-outreach-draft`**
- An approved action of another tool used as `_agent_action_id`: **403**. The approved draft: sent once; a second use: **409**.
- A payment reminder (draft from `send-invoice-chase`) for the same invoice twice in a day: 200 then **409** with reason `reminder_recent`; for a paid or cancelled invoice: **409** reason `settled`. Any other outreach draft: unchanged.
- Rollback: re-paste `send-outreach-draft__before.ts`, redeploy `send-outreach-draft`.

**T `desk-ai`**
- A free account is held by the 500 a day ceiling, not 10.
- Rollback: re-paste `desk-ai__before.ts`, redeploy `desk-ai`.

**T `desk-agent`**
- A free account is held by the 500 a day ceiling, not 20.
- Rollback: re-paste `desk-agent__before.ts`, redeploy `desk-agent`.

**T `thrive-ai-chat`**
- A free account is held by the 500 a day ceiling, not 30.
- Rollback: re-paste `thrive-ai-chat__before.ts`, redeploy `thrive-ai-chat`.

**T `scout-gigs`**
- A free account runs Scout beyond the weekly preview.
- Rollback: re-paste `scout-gigs__before.ts`, redeploy `scout-gigs`.

**T `thrive-voice-turn`**
- A free account's daily voice seconds no longer refuse the turn (still counted).
- Rollback: re-paste `thrive-voice-turn__before.ts`, redeploy `thrive-voice-turn`.

**U `route-studio-outcome`**
- The seven quick-start prompts answer 200 with no AI call; the function never answers 402 or 429. The frontend publish alone fixes the Studio error: this paste only makes the function consistent.
- Rollback: re-paste `route-studio-outcome__before.ts`, redeploy `route-studio-outcome`.

**W `create-curated-stage`**
- A scout host who switched "Record this stage" off: the new stage has `recording_enabled = false` (it was forced to true).
- `recording_enabled: true` (boolean): true. Any other value or an absent field: false.
- Rollback: re-paste `create-curated-stage__before.ts`, redeploy `create-curated-stage`.

**X `send-event-invite`**
- Event owner, three valid addresses: 200, `delivered: 3`. Non-owner: **403**, no count read.
- An address already invited three times in 24 h by hosts: listed in `skipped_recently_contacted`, not mailed.
- An account at 500 in 24 h: **429**. Registry rows `event-invite-direct` carry the host in `metadata`.
- Rollback: re-paste `send-event-invite__before.ts`, redeploy `send-event-invite`.

**Y `send-invoice-chase`**
- Draft for an overdue invoice (`send: false`): 200, `sent: false`. Paid or cancelled invoice: **409** reason `settled`, no AI request.
- `send: true`: first call `sent: true`; again within 24 h: `sent: false` with the downstream reason.
- Rollback: re-paste `send-invoice-chase__before.ts`, redeploy `send-invoice-chase`.

**Y `notify-swipe`**
- A real right swipe: first call email + push; the second: `duplicate: true`, nothing sent. No matching swipe: **403** (unchanged). The 61st in an hour: **429**.
- Rollback: re-paste `notify-swipe__before.ts`, redeploy `notify-swipe`.

**Y `notify-speed-pool-ping`**
- Host: 200, `notified: n`; again within 2 minutes: **429**. A non-host: **403**.
- Rollback: re-paste `notify-speed-pool-ping__before.ts`, redeploy `notify-speed-pool-ping`.

**Y `notify-speed-session-update`**
- A cancellation with a 2000-character reason: the stored message is 500 characters; again within an hour: **429**. `changes` sent as a string: ignored, no 500.
- Rollback: re-paste `notify-speed-session-update__before.ts`, redeploy `notify-speed-session-update`.

**Z `thrivefund-finalize-campaign`**
- A campaign with real authorisations below the goal and phantom `authorized` rows above it: not funded; the real authorisations are released, the phantom rows are `cancelled`, nobody is charged.
- A campaign whose verified authorisations reach the goal: funded; verified pledges captured (first tranche); an unverified one cancelled, never captured.
- Stripe unreachable for one pledge: **503**, nothing captured or cancelled. A re-run after finalisation keeps the outcome.
- Rollback: re-paste `thrivefund-finalize-campaign__before.ts`, redeploy `thrivefund-finalize-campaign`.

**Z `thrivefund-create-pledge`**
- Creator pledging to their own campaign: **403**. An amount above 10,000, three decimals, a string that is not a number: **400**.
- A second pledge by the same account while the first Checkout is complete: **409**; while it is open: the open session is expired and replaced.
- A normal pledge still creates one `authorized` row and a manual-capture Checkout session (mechanics unchanged).
- Rollback: re-paste `thrivefund-create-pledge__before.ts`, redeploy `thrivefund-create-pledge`.

**AA `stripe-marketplace-webhook`**
- **Only after the invoices migration is applied** (section 8). A Stripe-paid invoice: the invoice is `paid`, with `paid_at` and `stripe_payment_intent_id`; the function answers 200.
- Same paste carries step M (#159): a digital purchase order is still created and only the paths inside the seller's folder are signed.
- If the invoice update fails the function answers **500** (Stripe retries); it never answers 200 for a payment it could not record.
- Rollback: re-paste `stripe-marketplace-webhook__before.ts`, redeploy `stripe-marketplace-webhook`.

**AB `checkout-event-tickets`**
- A free ticket with a single-use promo code requested by several buyers at the same moment: exactly one is granted, the others get "Promo code fully redeemed" (400).
- A free ticket whose capacity is gone: refused, and the promo use is given back (the code's `uses_count` is unchanged).
- A quantity of 1.5 or the string "2": **400** "Invalid quantity". A paid ticket still creates one Checkout session; fee, destination and idempotency key are unchanged.
- A limited code whose remaining uses are held by other buyers' unpaid checkouts of the last 30 minutes: "Promo code fully redeemed"; the buyer's own pending order does not block them.
- Rollback: re-paste `checkout-event-tickets__before.ts`, redeploy `checkout-event-tickets`.

**AC `verify-event-ticket`**
- A paid Checkout session verified by the success page and the sessions list at the same moment: the order is `paid` once, the tier's `quantity_sold` rises by the order's quantity once and the promo code's `uses_count` by one; the second call answers `paid`.
- A session that Stripe does not report as paid: the status is returned and nothing is written.
- A tier whose capacity is gone at confirmation: the buyer is still seated and the order carries `metadata.capacity_exceeded` (as before).
- Logs: an "order claimed paid" line with no "verified" line after it for the same order id means the function stopped between the claim and the counters: report the order id.
- Rollback: re-paste `verify-event-ticket__before.ts`, redeploy `verify-event-ticket`.

**AD `purchase-event-ticket`**
- Pressing "buy" twice, or in two tabs, for the same untiered ticket: the second answers with the first open Checkout session's URL (one payment), never a second session.
- A buyer who already has a paid order for the event: refused ("You already have a ticket for this event"); a cancelled event: refused ("This event has been cancelled").
- An earlier open session at another price (the host changed it): expired, and a new one is created. A request with no Authorization header: "User not authenticated".
- A normal first purchase still creates one pending order and one Checkout session (price, fee, destination and quantity unchanged).
- Rollback: re-paste `purchase-event-ticket__before.ts`, redeploy `purchase-event-ticket`.

**AE `wallet-transfer`**
- An amount with a third decimal (0.005), a string amount or a missing recipient: refused ("Amount must be at least 0.01 and have at most two decimals" / "Missing or invalid recipient/amount"); no balance changes.
- Two transfers of the same day labelled EUR and USD count in one daily total: the limit applies to their sum (the limit check receives `USD` for every label but TTD).
- A normal transfer of 10.00 still debits the sender and credits the recipient by exactly 10.00; the stored currency is `USD` (or `TTD`).
- Logs: "ROLLBACK FAILED" means a debited sender was not refunded after a failed credit: repair by hand.
- Rollback: re-paste `wallet-transfer__before.ts`, redeploy `wallet-transfer`.

**AF `batch-milestone-payout`**
- Release of held escrow by the payer recorded on the PaymentIntent: captured and recorded (milestone `paid`, escrow `captured`, invoice created).
- Release by a project owner who is not the recorded payer: that milestone is refused with "You are not the payer for this milestone" and nothing is captured for it.
- A completed milestone with no escrow: returned `not_available`; no Checkout session is created and no charge is made.
- A capture whose row update fails: `captured_not_recorded` in the result and an "ERROR captured but not recorded" log line: repair by hand. The frontend (MilestoneBoard, "Release all") ships with the next publish; either order is safe.
- Rollback: re-paste `batch-milestone-payout__before.ts`, redeploy `batch-milestone-payout`.

**AG `create-milestone-payment`**
- A milestone that is paid, captured or already funded in escrow: **409** ("This milestone has already been paid." / "Funds for this milestone are already held in escrow."); no Checkout session is created.
- A milestone whose amount is missing, zero, negative or has fractions of a cent: **422**; a normal milestone still returns one Checkout session with the same breakdown (talent rate, service fee, manager commission).
- A milestone whose escrow was cancelled can be funded again. The success and cancel URLs and the session metadata carry the milestone's own project id, whatever the request said.
- **Depends on the row:** the guard is only as strong as who may write `milestones.status`, `escrow_status` and `paid_at` (section 8, grants question).
- Rollback: re-paste `create-milestone-payment__before.ts`, redeploy `create-milestone-payment`.

**I `create-meeting`**
- Meeting from your own project: **200**; from a project you do not belong to: **403** and no new Daily room.
- Meeting in your own Circle: **200**; in a Circle you did not create or join: **403**.
- No `record_consent` in the request: `recording_enabled = false` and `transcript_enabled = false`; with `record_consent: true` and the host's toggle on: recording starts (needs the frontend of #175 published first).
- Logs: any 403 on a normal flow means a path was missed: roll back and report.
- Rollback: re-paste `create-meeting__before.ts`, redeploy `create-meeting`.

## 7. Order of work in one session

1. Section 3 pre-checks (including the `__before` copies).
2. Paste every helper of section 4, in table order (no deploy needed).
3. Functions in table order: E (1), F (1), H (1), G (1), J (1), K (4), L (4), M (0, see AA), N (5, after the cron check), P (4), Q (1), R (3), S (2), T (5), U (1), W (1), X (1), Y (4), Z (2: **before any ThriveFund finalization**), AA (1: **only after the migration of section 8 is applied**), AB (1), AC (1), AD (1), AE (1), AF (1), AG (1). Step M has no separate paste: its file is pasted once, at AA. One at a time; verify; watch the logs.
4. Publish the frontend once (all the frontend PRs of section 1).
5. Only then, with the owner's release of section 2b and the logs watched, paste step I and verify it.
6. Fill the deployment record below and keep the `__before.ts` copies for the first full day of logs.

| # | Step | Function | Pasted by / when | Checksum matched | Verified | Logs reviewed | State |
|---|---|---|---|---|---|---|---|
| 33 | E | `mint-meeting-token` | | | | | not deployed |
| 34 | F | `get-recording-link` | | | | | not deployed |
| 35 | H | `book-meeting` | | | | | not deployed |
| 36 | G | `daily-recording-webhook` | | | | | not deployed |
| 37 | J | `redeem-project-share` | | | | | not deployed |
| 38 | K | `get-download-urls` | | | | | not deployed |
| 39 | K | `complete-product-purchase` | | | | | not deployed |
| 40 | K | `generate-studio-image` | | | | | not deployed |
| 41 | K | `generate-deal-memo` | | | | | not deployed |
| 42 | L | `generate-moodboard-image` | | | | | not deployed |
| 43 | L | `generate-studio-copy` | | | | | not deployed |
| 44 | L | `studio-ingest` | | | | | not deployed |
| 45 | L | `match-event-guests` | | | | | not deployed |
| 46 | N | `send-activity-digest` | | | | | not deployed |
| 47 | N | `send-streak-warning` | | | | | not deployed |
| 48 | N | `send-reengagement` | | | | | not deployed |
| 49 | N | `send-get-paid-link` | | | | | not deployed |
| 50 | N | `verify-guest-opportunity` | | | | | not deployed |
| 51 | P | `send-phone-otp` | | | | | not deployed |
| 52 | P | `merge-accounts-init` | | | | | not deployed |
| 53 | P | `send-outreach-email` | | | | | not deployed |
| 54 | P | `verify-brand-credit` | | | | | not deployed |
| 55 | Q | `agent-send-dm` | | | | | not deployed |
| 56 | R | `send-project-invitation` | | | | | not deployed |
| 57 | R | `send-event-blast` | | | | | not deployed |
| 58 | R | `send-credit-invite` | | | | | not deployed |
| 59 | S | `copilot-collaborator-tools` | | | | | not deployed |
| 60 | S | `send-outreach-draft` | | | | | not deployed |
| 61 | T | `desk-ai` | | | | | not deployed |
| 62 | T | `desk-agent` | | | | | not deployed |
| 63 | T | `thrive-ai-chat` | | | | | not deployed |
| 64 | T | `scout-gigs` | | | | | not deployed |
| 65 | T | `thrive-voice-turn` | | | | | not deployed |
| 66 | U | `route-studio-outcome` | | | | | not deployed |
| 67 | W | `create-curated-stage` | | | | | not deployed |
| 68 | X | `send-event-invite` | | | | | not deployed |
| 69 | Y | `send-invoice-chase` | | | | | not deployed |
| 70 | Y | `notify-swipe` | | | | | not deployed |
| 71 | Y | `notify-speed-pool-ping` | | | | | not deployed |
| 72 | Y | `notify-speed-session-update` | | | | | not deployed |
| 73 | Z | `thrivefund-finalize-campaign` | | | | | not deployed |
| 74 | Z | `thrivefund-create-pledge` | | | | | not deployed |
| 75 | AA | `stripe-marketplace-webhook` | | | | | not deployed |
| 76 | AB | `checkout-event-tickets` | | | | | not deployed |
| 77 | AC | `verify-event-ticket` | | | | | not deployed |
| 78 | AD | `purchase-event-ticket` | | | | | not deployed |
| 79 | AE | `wallet-transfer` | | | | | not deployed |
| 80 | AF | `batch-milestone-payout` | | | | | not deployed |
| 81 | AG | `create-milestone-payment` | | | | | not deployed |
| 82 | I | `create-meeting` | | | | | not deployed |

## 8. Gates that are not part of this bundle (SQL and payments)

| Gate | State | What unblocks it |
|---|---|---|
| **M-A** (`is_meeting_member` / `is_meeting_host` grants and membership status) | **blocked** | B1 definition: GO (identical to migration `20260512184606`). B2 grants: **NO-GO as designed**: `anon`, `authenticated` and `service_role` can execute both helpers with a caller-supplied user id; revoking `authenticated` would break the RLS policies that call them, so only `anon` and `PUBLIC` can go, with an own-uid guard (design decision). B3: the 5 SELECT dependents returned (meetings, meeting_participants, meeting_recordings, meeting_transcripts, storage.objects bucket `meeting-recordings`); **functions and views not returned**. B4: only the realtime publication returned; **full policy list and triggers on `meeting_participants` not returned**. B5 impact counts: **not returned**. Until B1 to B5 are returned and reviewed, a `denied` or `removed` participant still reads meeting rows, recordings, transcripts and realtime through the data API |
| M-B to M-E | proposals | `schema-policy-impact-meetings.md`, each after M-A |
| Commerce C-A to C-E | proposal (5 decisions owed) | `schema-policy-impact-commerce.md` (#160) |
| **SQL file in this program, applied only by the owner** | **reviewed file, not applied** | `supabase/migrations/20261015100000_invoices_provider_reference.sql` (PR #187), SHA-256 `41fada0659e74fc46f8a67e75e03753ca96dbadd5bdef1fee758c64ce90b6ee7`: the nullable `invoices.stripe_payment_intent_id` column and a BEFORE INSERT trigger that refuses an API insert of an invoice that is already paid. Apply it, then paste step AA, then publish the frontend. The production check of 2026-10-15 showed the column does not exist |
| Wallet transfer (`wallet-transfer`) | **input checks (step AE); SQL items and one production question left** | the limit check is not atomic with the debit, counts `failed` rows and a keyed request's own pending row twice, and debit and credit are two calls (a migration). **Read-only production question: does `wallet_transfers.idempotency_key` exist with a unique index?** No repository migration adds it. Currency semantics (one USD balance, 15 labels, TTD limits) are a product decision. Evidence: `wallet-transfer-input-evidence.md` (PR #195) |
| Milestone payment session (`create-milestone-payment`) | **funded milestone refused (step AG); one production question** | the guard trusts the milestone row. `20260824100000_milestones_privilege_hardening.sql` is headed "PREPARED, NOT APPLIED" and records a live test where a direct client PATCH of `status = 'paid'` and `escrow_status = 'authorized'` returned 204; `20260910130000` and `20260913110000` follow it. **Read-only production question: which columns of `public.milestones` can `authenticated` UPDATE (`information_schema.column_privileges`)?** If `status`, `escrow_status` or `paid_at` appear, every payment function's guard can be set by the party it constrains. Evidence: `milestone-payment-session-evidence.md` (PR #197) |
| Milestone payout (`batch-milestone-payout`) | **payer-bound, unreconciled checkout removed (step AF); one open question** | **who pays the creator after a capture is not visible in the repository functions**: collection is on the platform account (a destination exists only for a manager commission) and neither capture function transfers to the payee. A captured-but-unrecorded milestone is not repairable by retry (a repair path needs approval); a real combined payment needs a design. Evidence: `batch-milestone-payout-evidence.md` (PR #196) |
| Legacy ticket purchase (`purchase-event-ticket`) | **one live purchase per buyer (step AD); four items left** | left open: no `transfers`-capability check (fails closed at Stripe), the guest-list guard also blocks an `interested` RSVP (product choice), event privacy not assessed, and no unique index (a migration) for two truly simultaneous requests. Evidence: `legacy-event-ticket-purchase-evidence.md` (PR #194) |
| Event ticket confirmation (`verify-event-ticket`) | **counted once (step AC); access still open** | the paid transition is an atomic claim, so two simultaneous verifications no longer count twice (`event-ticket-confirmation-claim-evidence.md`, PR #193). The function still requires no signed-in user (it can only finalise an order Stripe says is paid): requiring the buyer or the host is an access decision for the owner |
| ThriveFund pledge state | **B and C approved and built (step Z); A is a proposal** | `proposal-thrivefund-pledge-authorization-state.md` (#180). B (#184) and C (#185) are step Z. A (`proposal-thrivefund-pending-pledge-state.md`, #186) needs a migration, a webhook and a Stripe endpoint. Until step Z is pasted, do not let `thrivefund-finalize-campaign` run on a campaign whose `total_raised` was not compared with Stripe by hand |
| Durable send registry, Gmail credential storage, Twilio spend controls, account-merge OTP template | proposals | `proposal-outbound-send-registry.md`, `proposal-gmail-credential-storage.md`, `proposal-twilio-spend-controls.md`, `proposal-account-merge-otp-template.md` |
| Cron header check (step N), cron jobs, secrets | owner action | not changed by this program |

## 9. Company Experience

No Company Experience feature is implemented. Each one waits for its security gate to be proven, then uses the canonical workspace, project, user and role records, enforces authorisation server-side and is tested for owner, company admin, member, client or guest, revoked and unrelated users. See `gate-audit-company-experience-execution-matrix.md`.

## 10. What this bundle does not change

No SQL, no migration, no policy, no storage change, no cron change, no secret, no payment or payout logic.
