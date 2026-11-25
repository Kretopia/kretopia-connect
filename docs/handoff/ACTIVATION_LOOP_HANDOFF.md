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

## Paid Stage ticket confirmation email (2026-11-25, branch `claude/stage-ticket-email-20261125`)
- The same template in a ticket form: "Your ticket is confirmed", the amount Stripe reported ("12.00 EUR"), the calendar link,
  no "free up your spot" and nothing about refunds. Idempotency key `stage-ticket:<stage>:<user>`.
- Sent once, when the seat is new: a retried webhook or a reloaded return page finds the seat and sends nothing. Best effort.
- Repository: `finalizeStageTicket` (Stripe webhook) sends it via `sendStageTicketEmail` in `_shared/stageRegistrationEmail.ts`.
- **Production differs:** kretopia-app seats paid buyers in `verify-stage-ticket` (no webhook fulfilment, and no private-Stage
  entry check there, unlike the repository). The production copy to paste adds only the previous-seat read, the seat-error check
  and the email call. Prepared and tested outside the repository; deploy needs that file plus the updated helper and template,
  then `verify-stage-ticket`, `send-transactional-email` and `preview-transactional-email`.
- Verified: 6 webhook tests, 1 template test, 2 tests against the production copy; edge suite 47 files pass; tsc; lint at baseline.
- Not tested: real Stripe payment, real delivery.

## Paid Stage tickets: seating in production (2026-11-25, branch `claude/stage-ticket-seat-20261125`)
- **Incident:** kretopia-app received the repository's read-only `verify-stage-ticket` (about 03:09 UTC). Production's
  `stripe-marketplace-webhook` has no Stage ticket branch, so a paid ticket is charged but never seated. Not fixed in
  production yet: Lovable credits ran out, and Claude has no write path to kretopia-app.
- **Immediate fix (3 files, prepared, sent to the user):** production's previous `verify-stage-ticket` plus the email, and the
  updated helper and template.
- **Lasting fix (this branch):** the repository's `verify-stage-ticket` seats an unseated paid buyer itself through
  `finalizeStageTicket` (the webhook's fulfilment: entry rule, paid order, seat, one email). Safe to repeat; nothing is trusted
  from the caller (the session is read from Stripe). A private Stage without an invitation answers `reason: "invite_required"` and
  the page says so. After merge, production needs `verify-stage-ticket`, `_shared/stageCircleActivation.ts` (new there), and
  the updated helper and template.
- Verified: 4 tests on the real handler, stageTicket wiring updated; edge suite and circle/pages suites pass except 3 page
  tests that fail on main too (EventPage, EventsCards, noOrphanPages); tsc; lint at baseline.
- Not covered: a paid order refused for a private Stage stays `pending` (refund by hand).

## Frontend follow-ups, while kretopia-app is blocked (2026-11-25, branch `claude/frontend-followups-20261125`)
- main's test suite back to green: 22 failing tests were tests that missed deliberate changes (event times in the event's zone,
  /search redirect, event ticket fulfilment moved to the webhook, Scout at /scout, legal numbering, "Interested", signed-out
  Discover). Full suite: 541 files / 5719 tests pass. Removed the retired SearchResults page and its only component.
- Footer "Cookie settings" link: **not done**. The shared footer is the Landing page's own (EditorialFooter), and landing pages
  are preserved; needs an explicit decision. The cookie choice can already be reopened from the Privacy page.
- **Production findings for kretopia-app (backend, blocked on credits):**
  1. Paid Stage tickets are not seated (see above); fix = the four files after #383.
  2. Production `verify-event-ticket` seats paid event buyers with jam_participants status "rsvp", which the repository records
     as rejected by `jam_participants_status_check` (unchecked error), so paid buyers likely never join the guest list. The
     repository uses "going". Not verified against production data.
  3. Same drift risk as Stage tickets: the repository's `verify-event-ticket` is read-only and relies on a webhook branch
     production does not have. Never paste it alone into kretopia-app.

## Paid events: entry rule (2026-11-25, branch `claude/rsvp-ticketed-events-20261125`)
- Found: `rsvp_to_event` and the join policy on `jam_participants` let any member seat themselves on an event that sells paid
  tickets, for free (the agent function already refuses ticketed events; nothing else does).
- Prepared, not applied: `docs/security/events/T1_ticketed_event_entry/` (01 preflight, 02 apply, 03 verify, 04 rollback, README),
  rehearsed on a scratch Postgres 16. Needs the SQL Editor of kretopia-app (no credits needed, no deployment).
- #386 (the paid buyer is put on the list by the page) keeps working under the rule: a paid order passes it.
