# Activation loop handoff (2026-11-22)

Branch `claude/activation-loop-20261121`, local only: **not pushed, not merged, nothing deployed or applied**. Four commits on
`origin/main` at `4011ea2a1`. The pilot PDF was not available in this environment.

## Findings

| Issue | Evidence | Status | Fix |
|---|---|---|---|
| 46 MB video: completion unclear | `ProfileEditDialog.tsx` (old 938–950): storage `upload()` error ignored (supabase-js returns it, never throws), URL saved and "Video intro uploaded!" shown anyway; no state during upload. `VideoIntroSection` empty state said "Add a video intro" while uploading | Confirmed (feedback gap). Storage/public-render failure: unverified (bucket limits are not in migrations) | Dialog reuses `VideoIntroSection`; explicit uploading → saving → saved/failed, retry with same file, double-submit guard, playback fallback. Same bucket, same 50 MB limit |
| "Add credit" loop | `ICDBCreditForm` mounted only in `ViewProfileTabs`, which is mounted nowhere; Passport → "Your record" (`/credits`) → "Add your first credit" → `/profile?add=credit`, read by nothing | Confirmed | Add credit button in the owner's Passport overview; `?add=credit` opens the same form and drops the param; save refreshes data, no reload |
| Kreto import "Load failed" | Safari's text for a fetch with no HTTP answer, shown raw (`thriveCopilot.ts:240`, import dialog toast). `analyze-profile-url`: scraper and extraction calls had no timeout | Raw message: confirmed. Root cause (timeout past platform limit): **hypothesis**, no logs | 20 s / 45 s bounds; `{ success:false, code }` categories; `src/lib/importFailure.ts`; inline error keeps the link + "Add work manually" |
| Credit confirmed → owner | Trigger `notify_credit_owner_on_endorsement` links `/profile?tab=credits` (dead tab), says "verified your work"; no push/email for it | Confirmed | `/credits?credit=<id>` focuses the credit; paste script A1 fixes link/wording (**not applied**) |
| Incoming co-sign request | `cosignNotifications.ts`: in-app + push to the exact request | Already works (members) | — |

## Prepared, disabled, pending approval
- `FEATURE_PILOT_NEXT_MOVE` (env `VITE_FEATURE_PILOT_NEXT_MOVE=true`): one deterministic next move, steps Passport Live / First Proof /
  Co-Signed derived from real state, Later / Not relevant per browser. No awards, no storage, nothing public.
- `docs/security/activation/A1_cosign_notification_link/`: 01–04, rehearsed on scratch Postgres 16. Apply after the app build with
  `/credits?credit=` is published (older builds still land on `/credits`).

## Web Push / email (inventory, no changes)
- Push already: tap-only permission (`enablePush`), honest unavailable/blocked/not-configured states, sign-out release, 404/410
  subscription cleanup, no lock-screen detail. `VITE_VAPID_PUBLIC_KEY` is not in repo env files: production configuration **unverified**.
- Not done: push/email for "credit confirmed" (needs DB→function delivery, e.g. a database webhook on `notifications` insert of
  type `credit_cosigned` → `send-push-notification`); email delivery trace (production `send-transactional-email` hard-codes the
  `thrivein.io` sender; check the sender domain status in kretopia-app before any change).

## Measurement (existing `analytics_events`, categories only)
New events: `intro_video_upload` (outcome, category), `import_failed` (category), `credit_saved` (source), `next_action_used`
(move, choice). Authoritative signals stay in tables: credits, `credit_endorsements.status`. Cohort = accounts whose first
`credit_saved` falls in the week; W1/W4 = accepted confirmation or new credit within 7/28 days; exclude cohorts younger than the
window; report raw counts with rates; notification opens alone are not returns.

## Tests
Focused: 4 new files + updated (video 7, add credit 3, import 8, next move/link 8); related suites 23 files / 129 and 27 / 220 pass;
`tsc -p tsconfig.app.json` pass; lint at baseline on every touched file; `vite build` pass; edge function type-checked with Deno-only
errors filtered. **Not tested:** real uploads to production storage, real browsers' playback, live import against real sites, push
delivery, email delivery, the A1 script against production.

## Approvals needed
Push/PR of this branch · apply A1 · enable the pilot flag · VAPID/sender-domain check · P2 (QR, promo access, Founding OG: plan
mapping, eligibility, 100 vs 500, lifetime terms undecided — nothing built).

## Next action
Review and push this branch as a draft PR; publish; apply A1; then add push for `credit_cosigned` behind a flag.

## SoundStages readiness (2026-11-25, branch `claude/soundstage-readiness-20261125`, local, not pushed)
Fixed (commit `5b88834fd`):
- False "This Stage has ended": `LiveCallsPanel` treated `is_live = false` as ended, but `create-sound-stage` creates backstage
  Stages with `is_live = false`. Ended now means `ended_at` set; otherwise "This Stage hasn't opened yet" (`src/lib/stageLinkState.ts`).
- Shared `?join=` links wait for the session, and a signed-out visitor goes to `/auth?redirect=/circle?join=<id>` (it did nothing).
- Curated Stage: countdown at zero said "Doors are open" while still scheduled; now "Waiting for the host to open the doors"
  (countdown expiry is not the session starting). Header "Starts 5 minutes ago" is now "Waiting for the host". Start time shows the
  viewer's time zone. The page waits for auth before loading; a signed-out visitor to a private Stage gets Sign in (link kept).
Verified: 8 new tests (`StageLinkStates.test.tsx`); Stages, stagesWiring, LiveCallsPanel suites pass; tsc pass; lint at baseline.
`DiscoverPage.test.tsx` fails on main too (3 with main's code, 2 with this change): pre-existing.

Not tested / needs a real rehearsal before 17 December:
- Echo: no duplicate playback found in code (video tiles carry only video; one `<audio>` per remote session; Daily's default
  echo cancellation, no music mode). Likely causes to check live: speakers without headphones, one person in two tabs/devices.
- Capacity (audience Stages are capped at 200 by `create-sound-stage`), devices, mobile audio, reconnect behaviour.
Gaps found, not changed:
- Stage registration (`rsvp-curated-stage`) sent no confirmation (added below); reminders (`stage-reminders`: 24 h, 1 h, 15 min) are in-app
  only, linking to `/circle/stage/<id>`. Whether its 15-minute schedule runs in production is not visible in the repo.

## Stage registration confirmation email (2026-11-25, branch `claude/stage-rsvp-email-20261125`, local, not pushed)
- `rsvp-curated-stage` now queues `curated-stage-registration-confirmation` through `send-transactional-email` (service role;
  that function resolves the address, checks suppressions and queues). Helper: `_shared/stageRegistrationEmail.ts`.
- Once per state: new spot, new waitlist place, waitlist -> spot. A repeat RSVP sends nothing; idempotency key
  `stage-registration:<stage>:<user>:<status>`. Best effort: a failed send never fails the registration.
- Waitlist copy says nothing is reserved (no calendar link, no "free up your spot"). Time is stated in UTC; the Stage page shows
  the reader's zone. A private Stage's link keeps the invite the person used.
- Also fixed: a repeat RSVP on a full Stage moved someone who held a spot to the waitlist.
- Verified: 12 tests (handler with mocked backend and fetch, rendered template); edge suite 46 files pass; tsc pass; lint at
  baseline. Test-only aliases in `vitest.config.ts` render templates (React + a react-email stand-in).
- **Not tested:** real delivery, the Deno type check (no Deno here), email-client rendering.
- **Not covered:** paid tickets (`verify-stage-ticket`); reminders stay in-app.
- **Production (kretopia-app), after approval:** add the template file, its `registry.ts` line and
  `_shared/stageRegistrationEmail.ts`; in production's own `rsvp-curated-stage` (it differs from the repository's), add
  `title, starts_at, ends_at, host_user_id` to the stage select, the previous-status read before the upsert and the send block after
  it, exactly as in this branch. Deploy `rsvp-curated-stage` and `send-transactional-email` (which bundles the registry).
