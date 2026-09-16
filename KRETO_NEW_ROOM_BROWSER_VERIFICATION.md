# Kreto New Room Browser Verification

## Status: `BROWSER_VERIFIED` (desktop, the real end-to-end flow) — mobile/tablet viewport and Day-mode checks `DEFERRED` this pass

## What was actually run, live, in this session (desktop, authenticated)

1. Opened Studio (`/desk`) → Quick actions → "Start a project" → New Room opened. `KretoPresence` (`card`, idle) visible above "What are you making?" — confirmed via screenshot.
2. Typed a real brief ("A 2-day beach photo shoot for a swimwear brand next month.") and submitted.
3. The real `extract-brief` edge function returned a genuine structured draft: title "Tropical Sands Swimwear Collection Shoot", a real multi-sentence summary, and 7 real starter tasks.
4. Review screen: `KretoPresence` (`compact`) next to "Kreto structured your project — review and edit", state `proposal_ready` (confirmed no caution banner — correct, since the type was confidently inferred as `photo_shoot` and deliverables were non-empty).
5. Answered "Money involved? → No — personal/passion", clicked "Create all & open".
6. Toast "Studio room ready" fired; app navigated to `/desk/<real-project-id>`.
7. Landed on the real Studio room page: the "Your Studio is ready. Kreto set up a starting structure you can review and shape." acknowledgement rendered, with the `KretoPresence` `success` presence, above the existing project header.
8. Navigated away, then reloaded the exact same `/desk/<project-id>` URL directly: the acknowledgement correctly did **not** reappear — confirming the one-time, route-state-only design works against a real navigation history entry, not just in a unit test.
9. Checked console throughout: no errors attributable to this change. The only console errors present are the pre-existing, previously-documented `/__l5e/assets-v1/...` asset-proxy 404/400 pattern (confirmed non-bug in multiple prior reports this engagement).

## What was not run this pass

- **390×844 / 768×1024 live click-through**: attempted, blocked by a browser-automation input-delivery issue partway through (clicks stopped registering; confirmed via `read_page` showing no state change, not an app-side error). See `KRETO_NEW_ROOM_ACCESSIBILITY_REPORT.md`'s limitation note for the reasoning on why this is lower-risk than usual (no viewport-conditional code was added).
- **Day mode**: not reachable app-wide per the standing, previously-documented dark/midnight lock (`LANDING_DAY_NIGHT_VISUAL_QA.md`) — unrelated to this change, unchanged by it.
- **A real live-microphone recording**: not possible in a scripted browser session (no real audio input device). `listening`'s trigger logic is covered instead by `VoiceFirstCreateModal.test.tsx`'s mocked-`MediaRecorder`/`getUserMedia` tests (grant and denial paths both covered).
- **A real hard extraction failure / offline state**: not forced live this pass (would require either a real backend outage or disconnecting the test environment's network, neither of which was done against a shared dev environment). Covered instead by the unit tests that reject the mocked `extract-brief` call and assert the resulting `error` screen, preserved input, and retry behavior.

## Recommendation

Re-run items in "What was not run this pass" once mobile browser-automation is working again in this environment, ideally as a quick, low-risk follow-up rather than a blocker — none of the untested paths are new *logic*, only real-device/real-network conditions that unit tests already approximate faithfully.
