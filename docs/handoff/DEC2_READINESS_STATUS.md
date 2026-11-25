# December 2 readiness: status against Ethan's list

Written 2026-11-25 against `main` and the **published site** (www.kretopia.com). Statuses use Ethan's three words. **Nothing is marked
Working here unless it was seen working**: a fix that is only in code and tests is "Not ready for release" until its retest passes.
"Owner" is to be confirmed by Noé and Jeff; the first column says what evidence exists.

How the evidence was gathered: a read-only walk of the published site as a signed-out visitor on an emulated iPhone 13 (nothing was
submitted, no account was created), a read of the code, and automated tests. **No account was created in production and no payment was
made**: the "fresh phone" and "two-account" passes Ethan asks for still need to be run by a person, with test accounts you approve.

## The four release priorities (page 5)
| # | Priority | Status | Evidence | What is left |
|---|---|---|---|---|
| 1 | Direct Passport entry and signup | **Not ready for release** (fix ready, not yet live) | Confirmed live on the phone walk: `/passport` signed out lands on Match Directory; "Create my Passport" is a button that goes to `/auth?next=/profile` (the **sign-in** tab); sign-up opens on "Find my passport" (public-source search) with the account choices one click away. PR: new direct entry **`/start`** (signed out → sign-up on the account options, destination kept; member → their Passport); the directory's "Create my Passport" uses it; sign-up opens on the account options, the public-source search is the other choice | Merge, republish, then retest on a fresh phone. **Google and Apple are off by design** (`OAUTH_TEMPORARILY_DISABLED = true` in `Auth.tsx`): turning them on needs the providers configured in kretopia-app, which can't be seen from here. Until then sign-up is email and password |
| 2 | First Passport, first credit and share: release gate | **Not ready for release** | Not run. It needs a fresh signed-out phone, a real email, and an account created in production | You approve a test account; then run signup → verify email → save → reopen → add one credit → open the exact share link signed out. New: after the confirmation email the person now **continues to where they were heading** (Co-Sign request, invitation, opportunity) once the Passport is built, instead of landing on the Passport and losing it. Tested with a fake backend only. The onboarding URL vs the public URL question is not addressed |
| 3 | Source and trust labels | **Not ready for release** (not started) | Not changed. Import and public-source suggestions come from backend functions (`analyze-profile-url`, the public search) that can't be changed or deployed while the Lovable credits are out | Keep weak same-name matches out of suggestions, require explicit review, label identity verification / claimed credits / Co-Signs separately, never infer availability from job-seeking intent. Needs backend work, then a retest with a founder account |
| 4 | SoundStages guests and two-sided flows | **Not ready for release** | Confirmed live: a signed-out visitor sees "Couldn't load stages" with a Retry that can't work. PR: the visitor now sees "Sign in to see what's live" with Sign in and Join Kretopia (kept on return to the Stages). Also in main: a dropped call now says so and never ends the stage for everyone (#388); capacity limited to what the room holds | The two-account pass is not done: host and guest, two devices, audio and video both ways. The rehearsal check-list is in `STAGE_REHEARSAL_CHECKLIST.md` (rehearse by 10 December) |

## The fifteen items
| # | Item | Status | Evidence / what is left |
|---|---|---|---|
| 01 | Landing and fast signup | **Not ready for release** | Phone walk: the landing loads, its main buttons ("Join Kretopia", "Build Your Passport", "Explore Match", "Explore Scout") go to sign-up or the right feature, and the cookie notice is shown first. Open: Google/Apple off (see priority 1), fresh-phone signup and email return not run |
| 02 | Build and finish a Passport | **Not ready for release** | Not run end to end. Source and trust issues open (priority 3) |
| 03 | Identity and Co-Sign | **Not ready for release** | Not run with two accounts. The Co-Sign recipient's route through signup now keeps the destination (priority 2), untested live. ID/selfie verification is not enforced (earlier decision) and shows no real result yet |
| 04 | A reason to stay | **Not ready for release** | Not run |
| 05 | Share the Passport and EPK | **Not ready for release** | Not run live (link, QR, WhatsApp, X, LinkedIn, Story asset, tailored EPK, Pro website) |
| 06 | Scout from brief to Studio | **Not ready for release** | Needs a company and a creator account |
| 07 | Smart search, Match and Circle | **Not ready for release** | Not run |
| 08 | Service booking | **Not ready for release** | Not run (time zone, cancel, reschedule, duplicates) |
| 09 | Kreto sets up the right project | **Not ready for release** | Not run |
| 10 | Manage work and create inside Studio | **Not ready for release** | Ethan's Nov 25 pass only confirms an existing project opens |
| 11 | Company pages and permissions | **Not ready for release** | Not run |
| 12 | Inbox and messages | **Not ready for release** | Not run |
| 13 | Events | **Not ready for release** | In place: free RSVP and its confirmation email; a paid event entered only with a paid ticket (#387, applied); a paid buyer put on the guest list by the page (#386). Not run: organizer and guest on two accounts; the check-in or payment path |
| 14 | SoundStages | **Not ready for release** | See priority 4 |
| 15 | Final device and recovery pass | **Blocked** | Payments are kept off the live path: paid Stage tickets are paused (#385). kretopia-app's `verify-stage-ticket` (imports a file that doesn't exist there) and `verify-event-ticket` (writes `"rsvp"`) can't be fixed while the Lovable credits are out. **Monitoring, recovery and who makes the go/no-go call are not defined**: Ethan needs to name that person |

## Blocked, and by what
- **Lovable credits (kretopia-app is the backend):** the `verify-stage-ticket` and `verify-event-ticket` fixes, `send-transactional-email`, any change to import or search functions, the Stage card counter, the capacity limit on `create-curated-stage`.
- **Decisions and approvals:** creating test accounts in production; whether Google/Apple sign-in is configured; who owns each item; who makes the go/no-go call.

## Retest order (once the PR is merged and the site republished)
1. Fresh signed-out iPhone → landing → "Join Kretopia" → account options → email signup → confirm → onboarding → Passport. Record: pass or blocker.
2. The same, arriving from a Co-Sign request or an invitation: after onboarding you must land on that request, not the Passport.
3. Reopen the Passport and one credit; open the exact public share link signed out.
4. Signed-out Stages: "Sign in to see what's live"; Sign in returns to the Stages.
5. Two accounts, two devices: host opens a SoundStage, guest finds it and joins; audio and video both ways; mute, camera off, leave, host end.
