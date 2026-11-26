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
| SoundStage, two accounts, fake camera and microphone: host opens a Stage, backstage soundcheck shows the video, "Open doors & go live" | Working |
| Second account finds the live Stage in the list, joins it, hears the host; leaves; host leaves and the Stage ends (`end-sound-stage` 200, list reads "Nothing live right now") | Working |
| Recipient presses an accepting answer | Working **after the repair was run in kretopia-app** (26 Nov). Before it: refused with `verification_status cannot be escalated to peer directly` (HTTP 400). Now: `{"status":"accepted","success":true,"endorsement_count":1}`; the credit reads "Co-signed by 1 collaborator" |
| Recipient picks "Yes, and I want my credit too", signs up, confirms the email in a new tab, finishes onboarding | Working: lands on their own Passport and the claimed credit is on it |

## The four release priorities
| # | Priority | Status | Evidence | What is left |
|---|---|---|---|---|
| 1 | Direct Passport entry and signup | **Working** for email sign-up. **Blocked** for Google/Apple | Phone pass above. `/start` is live. Google and Apple are off by design (`OAUTH_TEMPORARILY_DISABLED = true` in `Auth.tsx`) | Turning them on needs the providers configured in kretopia-app: Noé to confirm they exist there |
| 2 | First Passport, first credit and share: release gate | **Working** | Sign-up → Passport → reopen → first credit → public link signed out → send for Co-Sign → recipient responds → recipient starts their own Passport: all seen working on the live site | A fresh account sees Match (35 profiles) and Scout ("Found 1 new gig. Matched 74 across 7 sources") on first visit. Nothing left on this gate, except Google/Apple sign-in (priority 1) |
| 3 | Source and trust labels | **Not ready for release** | Seen live on the first account: a new Passport showed **"Available for work"** to visitors although nobody chose it. Fixed (live 26 Nov): a fresh account's public Passport shows no availability claim until the member sets one (checked on a new account) | Backend-side items (import suggestions, same-name matches) cannot change without the Lovable credits. Frontend labelling of identity / claimed credit / Co-Sign is still to do |
| 4 | SoundStages guests and two-sided flows | **Not ready for release** | Signed-out visitor now sees "Sign in to see what's live" (live). A dropped call says so and never ends the stage for everyone (#388). Two-account pass on the live site with fake devices: create, soundcheck, go live, guest joins and hears the host, guest leaves, host ends (see table above) | Not seen: real people hearing and seeing each other both ways; the guest speaking; mute and camera off (Mute is shown only once live; the guest has neither as a listener); declined camera or microphone permission. In a **Group** Stage the guest joins as a listener with "Raise hand" only, and the host must promote them: confirm this is intended for "Group". The Stage card kept saying "Live now 2" with fewer people in. The browser console says `daily-js 0.89.1 is no longer supported`. Rehearse by 10 December with `STAGE_REHEARSAL_CHECKLIST.md` |

## The fifteen items
| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 01 | Landing and fast signup | **Working** (email) / **Blocked** (Google, Apple) | Landing buttons go to sign-up or the right feature; sign-up seen working on a phone. A fresh account is met by three stacked first-view pop-ups (who's using Kretopia, the tour, the look) and answering the first one leaves the Passport for Creative Circle: confusing, not blocking |
| 02 | Build and finish a Passport | **Working** (manual build) | Manual build, first credit and public link all work; the availability label no longer claims anything unchosen. The import path (LinkedIn, IMDb, Spotify...) was not retested and depends on backend functions that cannot be changed without the Lovable credits |
| 03 | Identity and Co-Sign | **Working** for Co-Sign; identity check not enforced | Request, recipient answer and the recipient's own Passport all work since the repair (see table above). ID/selfie verification is not enforced (earlier decision). To check: once a credit has one co-sign, its card no longer offers "Ask for a co-sign", yet two are needed to reach Verified: confirm where a second request is made |
| 04 | A reason to stay | **Not ready for release** | Not run |
| 05 | Share the Passport and EPK | **Not ready for release** | Public link seen working signed out. Not run: QR scan, WhatsApp, X, LinkedIn, Story asset, tailored EPK, Pro website |
| 06 | Scout from brief to Studio | **Not ready for release** | Needs a company account and a second creator: not run |
| 07 | Smart search, Match and Circle | **Not ready for release** | Not run |
| 08 | Service booking | **Not ready for release** | Not run (time zone, cancel, reschedule, duplicates) |
| 09 | Kreto sets up the right project | **Not ready for release** | Not run |
| 10 | Manage work and create inside Studio | **Not ready for release** | Ethan's Nov 25 pass only confirms an existing project opens |
| 11 | Company pages and permissions | **Not ready for release** | Not run |
| 12 | Inbox and messages | **Not ready for release** | Not run |
| 13 | Events | **Not ready for release** | In place: free RSVP and its email; paid event tickets paused (see decision 2); a paid event is entered only with a paid ticket (#387, applied); a paid buyer returning from an earlier checkout is put on the guest list by the page (#386). Not run: organizer and guest on two accounts; check-in |
| 14 | SoundStages | **Not ready for release** | See priority 4: the technical path works with two accounts; the human audio/video check and the listener-only guest question are open |
| 15 | Final device and recovery pass | **Blocked** | Paid Stage tickets are paused (#385) and so are paid event tickets. kretopia-app's `verify-stage-ticket` (imports a file that is not there) and `verify-event-ticket` (writes `"rsvp"`) cannot be fixed without Lovable credits. Monitoring and recovery are not defined |

## Decisions for Noé (everything else is already decided)
1. **Co-Sign repair: done** (26 Nov, run in kretopia-app's SQL Editor; the function now raises the credits guard flag). Nothing left.
2. **Paid event tickets** (affects one live paid event): `verify-event-ticket` writes `"rsvp"`, which the guest-list table does not allow, so a buyer may not be seated by it. Either keep selling and let the page seat the buyer (#386), or pause paid event tickets like paid Stage tickets. Recommendation: pause until the function is fixed.
3. **Availability default:** no longer needed for the public label (fixed in the page). Optional: `ALTER TABLE public.profiles ALTER COLUMN availability_status DROP DEFAULT;` in the SQL Editor would also stop new rows being stored as "available". It changes no existing row.
4. **Sender name on the confirmation email** (`thrivein.io` today): needs the sender domain changed in kretopia-app.

## Blocked, and by what
- **Lovable credits (kretopia-app is the backend):** `verify-stage-ticket` and `verify-event-ticket` fixes, `send-transactional-email`, import and search functions, the Stage card counter, the capacity limit on `create-curated-stage`.
- **People with real devices:** the audio/video check between two real people (the fake-device pass cannot judge sound or picture).

## Retest order
1. Fresh phone: `/start` → sign-up → confirm → Passport → credit → public link. **Done once, passed.**
2. Send a Co-Sign request; the recipient accepts signed out, then starts their own Passport. **Done, passed (26 Nov).**
3. Signed-out Stages: "Sign in to see what's live"; Sign in returns to the Stages.
4. Two real devices: host opens a SoundStage, guest joins; audio and video both ways; the guest raises a hand and is promoted; mute, camera off, leave, host end. (Fake-device version passed once.)
5. Company posts a brief → creator applies → interview and accept → one correctly configured Studio project opens.
