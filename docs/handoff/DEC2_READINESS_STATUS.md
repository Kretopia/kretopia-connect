# December 2 readiness: status against Ethan's list

Updated 2026-11-25 against `main` and the **published site** (www.kretopia.com, republished with the sign-up changes).
Statuses use Ethan's three words. **Nothing is marked Working unless it was seen working** on the live site; a fix that is only in
code and tests stays "Not ready for release" until its retest passes.

## Who decides
- **Go / no-go for December 2: Noé.** Noé decides every point on this list and has given Claude permission to act on each one
  (test accounts in production, the two-account passes, the retests).
- **Owner of every item: Noé** (decides). **Hands-on:** Claude does the code, the tests and the live passes; Noé does the only things
  that need his hands: Lovable *Publish* for kretopia-connect, and anything inside kretopia-app (its SQL Editor, its code editor), because
  Claude has no path into that backend and Lovable credits are out.
- Ethan reads this file; nothing here needs his decision except the paid-event question below.

## How the evidence was gathered
A phone-sized browser (emulated iPhone 13) on the published site. **Test accounts were created in production with Noé's approval**
(`plantiernoe50+qa-a@…`, handle `qa_creator_a`, "QA Creator A"; one test credit "QA Short Film (test credit)"; one Co-Sign request
to a made-up person). They carry QA in their names and are safe to delete. **No payment was made.**

## What was seen working on the live site (25 Nov, phone, signed out then signed in)
| Step | Result |
|---|---|
| `/start` signed out → sign-up opens on the account options, email and password | Working |
| Confirmation email arrives and its link returns to onboarding | Working (sender shown is `noreply@thrivein.io`, not Kretopia) |
| Onboarding (manual) → Launch → lands on the Passport with the welcome | Working |
| Reopen the Passport: details intact | Working |
| Add a credit by hand: saved, shown after reload, "get it confirmed so it counts" | Working |
| Open the Passport's public link signed out: name, handle, credit show; Message / Start a project / Claim Credits and Sign in are offered | Working |
| Co-Sign: "Ask for a co-sign" creates a one-tap link (no account needed) | Working |
| Recipient opens that link signed out: sees the request, three answers (Yes / Yes and I want my credit too / Not me) | Working |
| **Recipient presses an accepting answer** | **Fails.** The database refuses it: `verification_status cannot be escalated to peer directly` (HTTP 400). The recipient sees an error and the credit stays self-declared |

## The four release priorities
| # | Priority | Status | Evidence | What is left |
|---|---|---|---|---|
| 1 | Direct Passport entry and signup | **Working** for email sign-up. **Blocked** for Google/Apple | Phone pass above. `/start` is live. Google and Apple are off by design (`OAUTH_TEMPORARILY_DISABLED = true` in `Auth.tsx`) | Turning them on needs the providers configured in kretopia-app: Noé to confirm they exist there |
| 2 | First Passport, first credit and share: release gate | **Not ready for release** | Sign-up → Passport → reopen → first credit → public link signed out all seen working. The chain stops at "recipient responds" (Co-Sign accept fails) | Apply the Co-Sign repair (below), then rerun "send for Co-Sign → recipient responds → starts their own Passport". First matches and opportunities were not checked |
| 3 | Source and trust labels | **Not ready for release** | Seen live: a new Passport shows **"Available for work"** to visitors although nobody chose it (the database column defaults to `available`, and the page displayed that default). Code fix in this PR: no status on the profile, no claim shown. New accounts still carry the stored default (see decision 3) | Backend-side items (import suggestions, same-name matches) cannot change without the Lovable credits. Frontend labelling of identity / claimed credit / Co-Sign is still to do |
| 4 | SoundStages guests and two-sided flows | **Not ready for release** | Signed-out visitor now sees "Sign in to see what's live" (live). A dropped call says so and never ends the stage for everyone (#388) | Two-account call pass not run (needs a camera and microphone on two devices). Rehearse by 10 December with `STAGE_REHEARSAL_CHECKLIST.md` |

## The fifteen items
| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 01 | Landing and fast signup | **Working** (email) / **Blocked** (Google, Apple) | Landing buttons go to sign-up or the right feature; sign-up seen working on a phone. A fresh account is met by three stacked first-view pop-ups (who's using Kretopia, the tour, the look) and answering the first one leaves the Passport for Creative Circle: confusing, not blocking |
| 02 | Build and finish a Passport | **Not ready for release** | Manual build and first credit work. Import path not retested. Availability label issue (priority 3) |
| 03 | Identity and Co-Sign | **Blocked** | Request and recipient screens work; **accepting fails** because kretopia-app's database still has the first, uncorrected `submit_credit_endorsement_by_token`. The fix exists: `supabase/migrations/20261106130000_cosign_submit_raises_guard_flag.sql`, one function, no data change. ID/selfie verification is not enforced (earlier decision) |
| 04 | A reason to stay | **Not ready for release** | Not run |
| 05 | Share the Passport and EPK | **Not ready for release** | Public link seen working signed out. Not run: QR scan, WhatsApp, X, LinkedIn, Story asset, tailored EPK, Pro website |
| 06 | Scout from brief to Studio | **Not ready for release** | Needs a company account and a second creator: not run |
| 07 | Smart search, Match and Circle | **Not ready for release** | Not run |
| 08 | Service booking | **Not ready for release** | Not run (time zone, cancel, reschedule, duplicates) |
| 09 | Kreto sets up the right project | **Not ready for release** | Not run |
| 10 | Manage work and create inside Studio | **Not ready for release** | Ethan's Nov 25 pass only confirms an existing project opens |
| 11 | Company pages and permissions | **Not ready for release** | Not run |
| 12 | Inbox and messages | **Not ready for release** | Not run |
| 13 | Events | **Not ready for release** | In place: free RSVP and its email; a paid event is entered only with a paid ticket (#387, applied); a paid buyer is put on the guest list by the page (#386). Not run: organizer and guest on two accounts; check-in |
| 14 | SoundStages | **Not ready for release** | See priority 4 |
| 15 | Final device and recovery pass | **Blocked** | Paid Stage tickets are paused (#385). kretopia-app's `verify-stage-ticket` (imports a file that is not there) and `verify-event-ticket` (writes `"rsvp"`) cannot be fixed without Lovable credits. Monitoring and recovery are not defined |

## Decisions for Noé (everything else is already decided)
1. **Run the Co-Sign repair in kretopia-app's SQL Editor** (free, no credits): paste `supabase/migrations/20261106130000_cosign_submit_raises_guard_flag.sql`, then `docs/security/VERIFY_PENDING_MIGRATIONS_20261106.sql`; the Co-Sign line must read OK. Claude then reruns the recipient pass. This is the one thing between the first-run journey and green.
2. **Paid event tickets** (affects one live paid event): `verify-event-ticket` writes `"rsvp"`, which the guest-list table does not allow, so a buyer may not be seated by it. Either keep selling and let the page seat the buyer (#386), or pause paid event tickets like paid Stage tickets. Recommendation: pause until the function is fixed.
3. **Availability default:** to stop new accounts being stored as "Available", run `ALTER TABLE public.profiles ALTER COLUMN availability_status DROP DEFAULT;` in the SQL Editor. It changes no existing row. Existing "available" values cannot be told apart from chosen ones, so they are left alone.
4. **Sender name on the confirmation email** (`thrivein.io` today): needs the sender domain changed in kretopia-app.

## Blocked, and by what
- **Lovable credits (kretopia-app is the backend):** `verify-stage-ticket` and `verify-event-ticket` fixes, `send-transactional-email`, import and search functions, the Stage card counter, the capacity limit on `create-curated-stage`.
- **Cameras:** the two-device SoundStage pass.

## Retest order (after the Co-Sign repair is applied)
1. Fresh phone: `/start` → sign-up → confirm → Passport → credit → public link. **Done once, passed.**
2. Send a Co-Sign request; the recipient accepts signed out, then starts their own Passport and lands on it, not on the first Passport page.
3. Signed-out Stages: "Sign in to see what's live"; Sign in returns to the Stages.
4. Two accounts, two devices: host opens a SoundStage, guest joins; audio and video both ways; mute, camera off, leave, host end.
5. Company posts a brief → creator applies → interview and accept → one correctly configured Studio project opens.
