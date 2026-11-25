# Stage rehearsal checklist: live event on 17 December

Built from the code as of 2026-11-25, not from the product wishlist. Every "known" line below was read in the repository.
Run it with real people and real devices: no test in this repository can replace that. **Do the whole list once at least a week
before (by 10 December), so there is time to fix what it finds.**

## 0. Know these limits first
| Known | Where | What it means on the day |
|---|---|---|
| A scheduled Stage seats at most **190** (the form now stops there). Its video room holds `capacity + 10`, capped at **200** | `go-live-stage`, `stageCapacity.ts` | Older Stages created with a larger capacity can register people who then can't enter. Check any existing Stage's capacity |
| The room lasts **4 hours** after it opens | `roomSessionLimits.ts` | Plan the run of show inside 4 h, with margin |
| Audience members join **muted, camera off**; only the host starts live | `join-sound-stage`, `go-live-stage` | Speakers are promoted from the room (raise hand / promote) |
| No music mode, default echo cancellation | `create-sound-stage` | Live music will sound processed. Do not promise it |
| The number on a Stage card counts **joins**, not people present (never goes down, reconnects add one) | `join-sound-stage` | Don't use it as an attendance figure. Use the in-room list |
| Paid tickets are **paused** ("Tickets open soon") | #385 | Run the event free, or keep the pause until kretopia-app seats paid buyers |
| iPhone Safari can show a **black video tile** after the app was backgrounded or after rejoining. Mitigated, not confirmed fixed | `SoundStageRoom.tsx` (TODO ios-black-tile) | Test it on a real iPhone (section 5) |
| Reminders (24 h, 1 h, 15 min) are **in-app only**, sent by `stage-reminders` every 15 min. Whether that schedule runs in production isn't visible from the code | `stage-reminders` | Check a reminder really arrives (section 1) |
| Confirmation emails come from the sender domain hard-coded in `send-transactional-email` (`thrivein.io`) | production function | Check they reach the inbox and not spam (section 1) |

## 1. Registration and messages (a week or more before)
- [ ] Create the rehearsal Stage as a host: **free**, capacity 3, real title, cover, start time ~30 min away, recording on.
- [ ] Register 3 test accounts (different email providers: Gmail, Outlook, one other). For each:
  - [ ] the confirmation email arrives in under 2 minutes, in the **inbox**, reads "You're in for <title>", shows the time in **UTC** and the host;
  - [ ] "Add it to Google Calendar" opens the right title, time and a link back to the Stage.
- [ ] The 4th account: waitlist email says "Nothing is reserved yet" and offers no calendar link.
- [ ] Register the same account twice: no second email, and the spot is kept even though the Stage is full.
- [ ] Cancel one registration: the spot frees. **Write down what happens to the waitlisted person** (not verified in code: decide whether it is acceptable).
- [ ] Private Stage: the invite link works signed in, and signed out sends to sign-in and comes back to the same Stage.
- [ ] The 24 h / 1 h / 15 min reminders arrive (create a Stage starting in 25 h, 70 min and 20 min to see all three).

## 2. Doors
- [ ] Before the start time the page counts down, in the **viewer's own time zone**.
- [ ] At the start time, with the host not yet in: the page says "Waiting for the host to open the doors", **not** "Doors are open".
- [ ] The host goes live: attendees get in without refreshing; the Stage card shows live.
- [ ] A shared `?join=` link works signed in, and signed out goes to sign-in and returns.

## 3. Audio, with real people (needs headphones, then without)
- [ ] Host + 2 speakers, **with headphones**: clean sound both ways, no echo.
- [ ] One speaker **without headphones** next to the laptop: note the echo. Decide the rule for the day ("speakers wear headphones").
- [ ] The same account open in two tabs or two devices: expect echo (not a bug). Check nobody does this on the day.
- [ ] Audience joins muted; raise hand shows to the host; promote lets them speak; demote mutes them again.
- [ ] A speaker reloads the page: they come back with the right role (the room asks peers to re-announce speakers).
- [ ] Screen share of slides: legible on a phone-sized window; stop and restart works.
- [ ] Captions on/off, if you use them.

## 4. Capacity
- [ ] Rehearse with **as many real devices as you can get: 20 to 50 at least**. Watch the network indicator and the host's laptop CPU.
- [ ] 190+ can't be rehearsed by hand: state the target publicly as "up to 190", keep the form at its maximum.
- [ ] One person over the room limit gets a clear message, not a frozen screen (try it with a Stage of capacity 1 and a second device).

## 5. Phones and browsers (each on a real device)
- [ ] iPhone Safari, Android Chrome, desktop Chrome, Safari, Firefox: join, hear, speak after promotion, leave.
- [ ] iPhone: join, lock the phone for 30 s, unlock, then leave and rejoin. **Look for a black tile.** Audio must stay fine.
- [ ] Microphone permission **denied**: the page says so and doesn't hang.
- [ ] Bluetooth headset connects or disconnects mid-stage: sound follows the device.
- [ ] Low battery mode and a weak 4G connection: the network indicator warns, audio holds.

## 6. Connection loss (new behaviour in this branch)
- [ ] **Audience:** turn Wi-Fi off for 30 s. Expect a red notice "You were disconnected", the room closes, the Stage stays live for others. Re-enter from the stage list.
- [ ] **Host:** turn Wi-Fi off for 10 s, then 60 s. Expect the notice "Your stage is still open", and **the Stage is NOT ended**. Re-enter from the stage list as host: the speakers are still in the room.
- [ ] Host switches Wi-Fi to 4G mid-stage: audio returns without anyone rejoining, or the host rejoins in under 30 s.
- [ ] Host closes the laptop lid for 1 minute.
- [ ] **A host who chooses "Leave" does end the stage** (unchanged). Make sure nobody presses it by mistake: agree who is the only person who leaves last.
- [ ] If the room's 4 hours run out, the Stage row can stay "on air" on the list with a dead room. Note it: the host should end it on purpose.

## 7. Recording, end and after
- [ ] The recording consent is shown before recording starts. Say it aloud on the day too.
- [ ] After the Stage ends, the recording appears in **Recordings** within a few minutes (host only).
- [ ] The host ends the Stage: everyone sees it ended; the page says "This stage has wrapped".
- [ ] Check what attendees receive after (recap, follow-ups). Write down what is missing.

## 8. Day of: go / no-go
**T-24 h** Stage is free and registered; capacity ≤190; host and speakers have tested their device and Wi-Fi; a second device is ready, signed in as the host.
**T-60 min** Host in "backstage" with the mic check done; speakers briefed (headphones, how to raise a hand, who talks first).
**T-15 min** Open the doors only if the host is stable; post the join link in your channel.
**Go** if sections 1, 2, 3 and 6 passed on the rehearsal with no unexplained failure. **No-go / fall back** if the host reconnect test fails, if audio echoes with headphones on, or if more than one device type fails to join.
**Backup plan** (decide now): where you announce a change; whether the second host device can take over; who tells attendees what.

## Not fixed (needs kretopia-app, blocked on Lovable credits)
- The Stage card counter counts joins, not people.
- `create-curated-stage` still accepts a capacity up to 1000 when called directly (the form no longer does).
- A Stage whose room expires can stay on air in the list.
- `verify-stage-ticket` and `verify-event-ticket` fixes (paid tickets stay paused).
