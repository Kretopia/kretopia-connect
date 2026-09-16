# Sound Stages + Stage Options — End-to-End Audit

Date: 2026-06-22
Scope: Open Stages (`sound_stages`) + Curated Stages (`curated_stages`: Scout / Showcase / Speed) — every edge function, table, RLS policy, and client surface.

---

## TL;DR — Safe to onboard testers?

**Yes, after the fixes below ship.** The Open Stage flow is the simplest and most reliable. Curated/Scout stages add a lot of surface area (tickets, RSVP, applications, raise-hand, turns, outcomes) — usable today but I'd keep test #1 to Open Stages, then layer in Scout once you've watched one go well.

I fixed 4 latent crashers in this pass — same class of bug as the one you hit on apply (`.catch()` chained onto a Supabase query builder, which is not a Promise; it threw and bubbled). Notifications were the side-effect every time, so the user action would fail even though the real work succeeded.

---

## Architecture map

```
Open Stage (spontaneous)        Curated Stage (scheduled, 3 sub-types)
─────────────────────────       ─────────────────────────────────────
sound_stages                    curated_stages
  ├ create-sound-stage            ├ create-curated-stage
  ├ join-sound-stage              ├ go-live-stage  (also handles backstage)
  └ end-sound-stage               ├ end-curated-stage
                                  ├ rsvp-curated-stage
SoundStageRoom.tsx (1736 ln)     ├ checkout-stage-ticket  (paid)
SoundStagesRail.tsx              ├ verify-stage-ticket
GoLiveSheet.tsx                  ├ invite-to-stage   (private)
LiveCallsPanel.tsx               ├ apply-to-stage    (Scout only)
                                  ├ review-stage-application
                                  ├ raise-hand-stage
                                  ├ promote-raised-hand
                                  ├ start-stage-turn / end-stage-turn
                                  ├ record-stage-outcome  (co_sign | credit | rolodex | followup)
                                  ├ start-stage-transcription
                                  └ stage-reminders   (cron)
                                CuratedStage.tsx, StageHostConsole, ApplyToStageSheet,
                                CreateStageSheet, InviteToStageDialog, StageDoorsCountdown
```

Both backends share the same Daily.co room engine; both rooms are auto-destroyed via `dailyFrame.ts` singleton guard.

---

## Bugs fixed in this pass

All four were the same bug as `apply-to-stage`: `await admin.from(...).insert(...).catch(() => {})`. `PostgrestBuilder` is `PromiseLike` (only `.then`), so `.catch` is `undefined` → `TypeError` → the whole handler 500s even though the row was inserted.

| File | What was crashing |
|---|---|
| `review-stage-application/index.ts` | Notify applicant of decision |
| `raise-hand-stage/index.ts` | Notify host of raised hand |
| `promote-raised-hand/index.ts` | Notify applicant they're on |
| `record-stage-outcome/index.ts` | Connection insert + credit insert + notification (3 places) |

Fix pattern used everywhere: `try { await admin.from(...).insert(...); } catch (_) { /* non-fatal */ }`.

---

## Security / RLS — green

- `sound_stages`: SELECT open to authenticated; INSERT/UPDATE/DELETE host-only via `auth.uid() = host_user_id`. ✓
- `curated_stages` family (`_applications`, `_raised_hands`, `_turns`, `_rsvps`, `_invites`): applicant-or-host SELECT, applicant-scoped INSERT (`user_id = auth.uid()`), host-only UPDATE via `EXISTS (… host_user_id = auth.uid())`. ✓ No recursive policies; no missing GRANTs spotted on these tables.
- Private stage gate (`go-live-stage`): host OR matching `invite_token` OR email present in `curated_stage_invites`. ✓ But: `invite_token` is read off the row and compared in plaintext — fine, but if you ever leak a stage row publicly, the token leaks too. Today it's gated by RLS so this is theoretical.
- All edge functions validate JWT before touching admin client. ✓
- `record-stage-outcome` blocks non-hosts; `review-stage-application` checks host on the joined row; `promote-raised-hand` blocks non-hosts. ✓

No P0 security issue found in this slice.

---

## Reliability watch-list (not crashing, but fragile)

1. **`SoundStageRoom.tsx` is 1,736 lines.** It is the single largest UI surface on the platform and the single hottest "things that move at the same time" surface (Daily SDK + Realtime + presence + raise-hand + captions + screen share + transcription). It works, but any future change is high-risk. Plan to split into `useStageCall` + `useStageRoster` + `useStageCaptions` hooks before adding more.
2. **Daily room expiry mismatch.** Open Stage rooms expire in 4h, host token 4h, joiner token 2h. Curated rooms: 6h room, 4h tokens. A stage left running past expiry will silently fail joins with a confusing "Daily token failed" error. Add a friendlier toast + auto end-stage when this happens.
3. **`stage-reminders` cron.** Verify it's still in the cron list and routed through `requireAdminOrCron` (Phase 1.b standard). I did not see it in the manifest of CRON-classified functions — confirm before launch.
4. **No idempotency on `record-stage-outcome`.** A host who taps "Credit" twice creates two `credits` rows. Add a unique index on `(stage_id, applicant_user_id, outcome)` or check-before-insert.
5. **`SoundStagesRail` realtime subscription** refetches the full top-20 on every postgres_changes event — fine at current volume, will be noisy when you have 50+ live stages. Switch to event-driven row patching when that happens.
6. **No "stage abandoned" janitor.** If a host closes their browser without tapping End, `is_live` stays `true` forever and the rail keeps showing a ghost stage. Add a cron (or a Daily webhook on `meeting.ended`) that flips `is_live=false` after N minutes of zero participants.
7. **Mobile mic/cam permissions** — `SoundStageRoom` has a 250ms wait after the mic-check preview to release media. On older iOS Safari this is sometimes too short. If testers report a black tile, bump to 500ms.

---

## What you'd need to ship to confidently onboard 10–50 testers

| # | Task | Effort |
|---|---|---|
| 1 | Ship the 4 edge-function fixes above | done |
| 2 | "Stage abandoned" janitor (cron, every 5 min) | 30 min |
| 3 | Unique index on `(stage_id, applicant_user_id, outcome)` for credit dedup | 5 min |
| 4 | Friendlier "session expired, please restart" toast when Daily token rejects | 15 min |
| 5 | Add `stage-reminders` to the cron auth standard | 10 min |
| 6 | Smoke test: create → backstage → open doors → 1 joiner → raise hand → promote → demote → record co_sign → end. Twice (host on mobile, joiner on desktop, then swap). | manual |

I'd not block your test on the 1,736-line refactor — just don't add features to that file until after the test.

---

## My read on positioning: Stages > Events for onboarding

You're right, and here's the strongest version of why:

**Events are infrastructure. Stages are a hook.**

- The events market is saturated with Eventbrite, Luma, Partiful, Posh, Dice — these are run by people who know they're running an event. They arrive with a date, a venue, and a list. The decision to use *your* event tool is a commodity choice.
- "Sound Stage / Scout Stage" is a *behaviour* nobody else owns end-to-end. The closest things are Clubhouse (dead), Twitter Spaces (irrelevant for creatives), Discord stages (gated to servers), and IG Live (no roster, no co-sign, no credit, no follow-up Rolodex). You have an unclaimed lane that maps 1:1 to how creatives actually scout each other — open a room, jam, decide who's in, stamp the moment.
- Stages are **zero-prep**. Tap "Go Live" → friction is gone → first session in 30 seconds. Onboarding a creative on "post your first event" requires them to *have* an event. Onboarding them on "open a stage and see who shows" requires only that they exist.
- Stages naturally generate the **5 things that retain creatives**: a credit (Stamp), a co-sign, a new Connection, a Rolodex add, and a follow-up. That's the moat firing on every successful stage. An event fires that once a month if you're lucky.
- Events make more sense as a **community surface** — Crew/Circle hosts running their meetup, panel, party. That's also exactly where event platforms underserve them today (no roster of creatives in the room, no post-event credit). So events become a *Crew feature*, not a personal feature, which is the right shape.

**My recommendation:**

- **Sound Stages = the consumer onboarding hook.** "Tap to go live. Anyone in the world who hits your link is in a room with you in 5 seconds." This is the demo you put on the landing page.
- **Scout Stages = the creator → opportunity hook.** Hosts open Scout, applicants pitch, host scouts, Stamp/Co-sign drops on the spot. This is the "no other platform does this" moment.
- **Events = the Crew/Circle hook.** Reposition the events surface as "Run your community's event" instead of a peer feature. Keep it, but stop fighting Luma.

If you want, after the stabilize test I can write the marketing copy + landing module that leads with the Stage demo and demotes events into the Crew section.

---

## Files touched

- `supabase/functions/review-stage-application/index.ts`
- `supabase/functions/raise-hand-stage/index.ts`
- `supabase/functions/promote-raised-hand/index.ts`
- `supabase/functions/record-stage-outcome/index.ts`
- `SOUNDSTAGES_AUDIT.md` (this file)
