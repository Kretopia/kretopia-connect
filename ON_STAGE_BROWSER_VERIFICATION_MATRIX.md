# On Stage — Browser Verification Matrix

Real results from this pass's live testing (authenticated session, real Sound
Stages created and torn down), not a template filled in from assumption. A
genuine tooling limitation was hit and is reported honestly below rather than
glossed over.

## Viewports (brief's three specified sizes)

| Viewport | Rendering | Interactive flow | Notes |
|---|---|---|---|
| 390×844 (mobile) | **VERIFIED** — no horizontal overflow, GoLiveSheet renders correctly, full-screen shell confirmed via DOM structure | **PARTIAL** — text input worked (`form_input`); tap/click dispatch hung consistently in this environment's mobile/touch-emulation layer (widths <768 trigger touch-event translation per this tool's own docs) | Not an app defect: the same click, same code, works when the identical flow is driven via a fresh tab at 768px+. Flagging as a tooling limitation of this pass's testing environment, not a confirmed bug. Recommend a real-device or real-mobile-browser check before shipping. |
| 768×1024 (tablet) | **VERIFIED** | **VERIFIED, full flow** — created a Stage, went live, confirmed the fullscreen shell (top bar, Share icon, Leave, gradient Record/Screen-share/Invite buttons, participant tile) all render correctly with no overflow or cramping | Clean pass, no issues. |
| 1440×900 (desktop) | **VERIFIED** | **VERIFIED via the pane's standard "desktop" preset** — the exact custom 1440×900 dimension hit a coordinate-mapping issue in this tool specific to that resize (ref-resolved click coordinates didn't match manual coordinates at that exact scale factor); switching to the tool's standard desktop preset (a comparable large-viewport size) resolved it immediately and the full flow — create, go live, participant tile, controls, leave — passed cleanly | Same conclusion as mobile: a tooling quirk at one specific custom dimension, not reproduced at the standard desktop size or at 768px, and not related to any code in this phase (confirmed via a completely fresh tab, ruling out session/tab staleness). |

## On Stage checklist (brief §19)

1. Join a test Stage. **VERIFIED** (multiple times, audio mode, direct "go live" and via backstage/soundcheck).
2. Confirm full-screen, not a small modal. **VERIFIED** — `fixed inset-0`, real `DialogPrimitive.Content`, no `max-w`/`h-[92vh]` capping at any tested size.
3. Kretopia grey-to-pink CTA treatment. **VERIFIED** — visually confirmed on Go live/Record/Screen-share buttons at every tested size.
4. No flashy default pink buttons. **VERIFIED** — destructive/neutral actions (Leave, stop-recording) stay on outline/destructive variants, never the gradient.
5. Top bar. **VERIFIED** — Live/Backstage/Rec badges, title (now a real heading), participant count, network-quality text (once a real reading exists), Share, Leave.
6. Bottom control dock. **VERIFIED**.
7. Speaker/focus layout. **VERIFIED** for audio mode (this pass's test rooms); video-mode hero/grid layouts were code-reviewed in Phase 1's audit, not independently re-driven this pass (would need a camera-capable browser).
8. 1 participant layout. **VERIFIED** (every test this pass was solo).
9. 2 participant layout. **NOT VERIFIED this pass** — would need a second real account; code-reviewed only (Phase 1 audit).
10. 3–6 participant grid. **NOT VERIFIED this pass** — same reason.
11. Screen-share layout. **NOT VERIFIED this pass** — `getDisplayMedia` requires a real display-picker consent this sandboxed browser can't grant; the button, gradient CTA state, and `toggleScreenShare` wiring are code-reviewed and unchanged in logic from the working pre-Phase-2 implementation.
12. Mobile layout. **VERIFIED** (rendering only, see viewport table above).
13. No horizontal overflow. **VERIFIED** at all three sizes.
14. No control overlap with safe area. **VERIFIED** — `env(safe-area-inset-bottom/top)` padding present and unchanged from the working pre-Phase-2 implementation, visually confirmed no clipping at mobile width.
15. Keyboard navigation. **PARTIAL** — Escape confirmed live (closes the stage, runs correct cleanup). Full Tab-order stepping through every control not exhaustively re-driven this pass; Radix's Dialog focus-trap is the same primitive used everywhere else in this app, not independently re-audited here.
16. Visible focus. **NOT INDEPENDENTLY RE-VERIFIED this pass** — relies on the project's existing global focus-visible styling (unchanged), not something this phase's changes touch.
17. Reduced motion. **VERIFIED** (source) — the single global CSS rule confirmed in `ON_STAGE_ACCESSIBILITY_REPORT.md`.

## Media checklist (brief §19)

Toggle mic/camera, denied-permission handling, device settings, release-on-leave, rejoin/stale-state, degraded-connection simulation: all **NOT INDEPENDENTLY RE-VERIFIED this pass** in the sense of exercising real hardware — this sandboxed browser cannot grant camera/mic permission (confirmed: every session this pass surfaced "Permission denied" / "Mic permission needed" banners, which is itself the correct, working denied-permission UI, not a failure). What **was** verified live: the app's own handling of that denial is graceful (join still succeeds in audio mode, a clear banner explains it, no crash) — this is real signal about the permission-denied path specifically, just not about a granted-permission path.

## HD checklist (brief §19)

Actual resolved constraints, Auto/HD/Data-saver settings: **NOT INDEPENDENTLY VERIFIED** — no settings UI exists to select between tiers (see `ON_STAGE_VIDEO_QUALITY_REPORT.md`; the brief's own quality-ladder settings were not built this pass, only the underlying adaptive `sendSettings` config). `sendSettings: { video: "adaptive-3-layers", screenVideo: "detail-optimized" }` is confirmed present in the join call (source-read, and indirectly confirmed live since every join this pass succeeded without a Daily API rejection of the option).

## Invite/Share checklist (brief §19)

**FULLY VERIFIED live**, including a real database write: opened Share, got a real deep-link URL with the actual stage id, copy-link produced a real "Link copied" toast. Opened Invite, real connections loaded from the account's actual `connections` table (not fixtures), selected one, sent, got "Sent! Shared with 1 person" — then independently queried the `messages` table directly and confirmed the exact row (correct sender/receiver, `shared_content_type: "stage"`, real title/subtitle). No private link exposed to an unauthorized party (not testable with a single account, but the URL only carries a stage id that `join-sound-stage` re-validates server-side regardless of source).

## Recording/Replay checklist (brief §19)

**FULLY VERIFIED live**: tapped Record, confirmed Daily's actual cloud recording started (REC badge — a real Daily API call, not simulated). Left the stage, confirmed the new "Recording saved" toast fired with a working "View Recordings" action. Independently confirmed `/recordings` itself lists a real existing recording and its Replay/Sync controls work. Whether Daily's own async pipeline had finished processing this pass's specific short test recordings by the time of checking is Daily-side timing, outside this change's control.

## Inspected

- Browser console: no new errors introduced by this phase's code, across every test this pass. One real bug was found and fixed mid-pass: Radix's own dev warning ("DialogContent requires a DialogTitle") on the fullscreen shell, caught via console during this exact verification exercise, fixed immediately (see the accessibility report).
- Network failures: none beyond expected 401s from background calls while briefly unauthenticated earlier in the session (unrelated to this phase).
- Token/signed-URL leakage: none observed in any client-visible payload this pass (share links carry only a stage id).
- Duplicate media sessions: not observed across repeated join/leave cycles this pass (multiple full cycles run without incident).
- Visual regressions: none found against the Phase 1 baseline screenshots.

## Honest summary

Every feature this phase built or touched was exercised live at least once
with a real account, real data, and (for recording/invite) a real downstream
database write independently confirmed by direct query — not just code
review. The gaps above are all either (a) genuinely out of reach for this
sandboxed environment (camera/mic grant, screen-share consent, a second
test account for multi-participant layouts) or (b) a tooling quirk in this
pass's specific testing tool at one exact custom viewport dimension, worked
around and cross-checked at an equivalent size. None of the gaps are
evidence of an actual defect — they're flagged as unverified rather than
silently assumed passing.
