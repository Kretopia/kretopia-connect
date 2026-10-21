# Roadmap

## Studio Calls Slice 5
- [x] Persist the existing Studio call surface across navigation; miniature status, timer, recording, participant initials/live iframe, mute, return, minimize and confirmed leave. Desktop drag; mobile safe-area placement; refresh starts idle.
- [x] 49 focused tests pass, including actual Studio controller with simulated Daily: one creation/join across routes and minimize, cleanup after confirmed end. Automatic preview compilation OK. Isolated desktop/320/360/375/414px checks pass with one stable iframe and 44px controls.
- [ ] Verify real authenticated Daily navigation/reconnect and CTA clearance on populated pages — blocked: external legacy live session unavailable; simulated checks cannot certify live media or all page overlays.
- [ ] Open one reviewable PR — blocked: GitHub PR tooling unavailable; no deployment.

## Studio Calls Slice 4
- [x] Adjust mobile live/floating/guest calls and lobbies at 320, 360, 375 and 414px: safe-area grids, 44px targets, dominant video and shared branding.
- [x] 45 focused tests and automatic preview compilation pass; 48 isolated browser cases in light/dark show no overflow, overlapping or obstructed controls. No deployment or recording pipeline changes.
- [ ] Verify real Daily video/sidebar rendering and physical-device safe areas — blocked: external legacy session/live call unavailable; browser checks simulate Daily only.
- [ ] Open one reviewable PR — blocked: GitHub PR tooling unavailable in this session.

## Studio Calls Slice 3
- [x] Add explicit Stop/Save reminder with existing state/sync; no call or pipeline changes.
- [x] 85 focused regressions and preview compilation pass; isolated reminder renders with two working actions, unchanged video bounds and no runtime errors.
- [ ] Verify real Daily checkpoint and replay read-back — blocked: external legacy session/live call unavailable in this sandbox.
- [ ] Open one reviewable PR — blocked: GitHub PR tooling unavailable in this session.

## Landing clean loading
- [x] Remove chapter video posters, avoid duplicate resource loads, fast-start remux three remaining videos without re-encoding; remove floating guest signup CTA. No automatic signup dialog exists in current Landing source.
- [x] Desktop/mobile: no posters, no signup dialog or floating signup CTA; 33 regressions and automatic compilation pass. No deployment. Actual video playback cannot be verified through sandbox media delivery (readyState 0).

## Shared loading performance
- [x] Split Home/global mascots, preserve reusable HTTP caches, defer housekeeping and shorten shared entrances; warm Landing chapters immediately and videos near viewport. Business workflows unchanged.
- [x] 33 cache/flight regressions pass; public Landing/About/Spotlight/Match render without runtime errors; chapters mount before scrolling, Passport text visible on entry. Automatic compilation OK.
- [ ] Measure live authenticated pages and production speed — blocked by unavailable external legacy session; sandbox asset delivery and video decoding cannot certify real-device media performance.

## Match card gestures and Holo
- [x] Fix stuck swipes; regression coverage for consecutive gestures, outside release and cancellation.
- [x] Reuse Passport Holo presentation without gesture interference; remove photo-like action.
- [ ] Verify live authenticated Match — blocked by external legacy session access; local gesture/card verification only.

## Match and Scout suggestion flow
- [x] Remove first-page discovery starvation and refill real suggestions quietly without duplicate requests.
- [x] Improve skill relevance while preserving visibility, blocks, swipes and explicit filters.
- [x] Focused regressions: 71 tests pass; automatic preview compilation OK; no backend deployment or publication.
- [ ] Verify live authenticated Match/Scout renewal — blocked: production uses external legacy authentication, unavailable to managed preview sessions.

## Public feature alignment
- [x] Align Spotlight, About Us and Hire Talent with compact shared feature headers and grouped content.
- [x] Replace their small labels with working How this works tutorials.
- [x] Remove feature page back arrows and their reserved spacing; preserve wizard steps and mobile conversation/sidebar dismissal.
- [x] Verify public tutorials, About tabs, Spotlight tabs and Hire Talent disclosures at desktop/375px; 11 shared-surface tests pass, no runtime errors. No publication. Live content fetching and existing logo delivery remain unverified in the sandbox.

## Kreto Landing flight
- [ ] Correct top-peek descent and bottom-peek ascent with shared Flying endpoints; remove artificial disappearance and run targeted regressions.
- [x] Keep each free journey facing its media destination, add reversible progressive peek emergence and crisp exclusive edge handoffs; 18 tests and 506 round-trip opacity/exclusive-pose/media-clearance checks pass; compilation OK, not published.
- [x] Correct stale internal slide handoffs and unsafe eased Flying departures; exact bidirectional peek transitions, full-box media clearance and rotation disabled near media. 17 tests and 506 bidirectional single-pose/opacity checks pass; automatic compilation OK; not published.
- [x] Lock both ledge poses to every media edge in both scroll directions, stop spring/hover/rotation drift and remove media scale animation; 10 locks and 50 bidirectional jitter checks confirm exact contact and exclusive opacity, 16 tests pass, compilation OK; not published.
- [x] Normalize all artwork heights, remove overlapping poses and prolong ledge holds; 14 path tests pass, full round-trip scroll confirms one visible pose and no runtime errors, automatic compilation OK; not published.
- [x] Match wave/bottom-peek visible height to Flying, confine hideaways to media footprints without viewport rescue, conceal heading changes and replace edge detours with direct media-to-media flight; 12 path tests pass, scroll playback has no runtime errors, compilation OK; not published.
- [x] Restrict route reversals to page edges with monotonic horizontal interpolation, tighten ledge contact and stabilize pose handoffs, add edge backflips and a reversible bottom double backflip; 12 targeted tests pass, downward/upward browser scroll has no runtime errors, automatic compilation OK; not published.
- [x] Stabilize heading with a dead zone, blend pose changes and Hero handoff, match Hero/flight container sizes, remove standing finale and limit journey to one backflip; nine path tests pass, downward/upward playback checked without runtime errors, automatic compilation OK; not published.
- [x] Keep full opacity beyond Hero handoff, cover all five chapter media with top/bottom and alternating side waypoints, improve viewport tracking and add upright director finale; nine tests pass, ten ledges, upward heading, full opacity and finale verified in browser; compilation OK, not published.
- [x] Extend ledge persistence, remove pose ghosting, reverse heading on upward scroll, accelerate flips and maintain visible hovering; eight tests pass, upward heading and opaque media layering verified in browser, reduced motion respected, compilation OK.
- [x] Preserve Passport takeoff, extend alternating hideaways to all five chapter media, remove edge-on flattening and make reversals scroll-linked; seven tests pass, foreground layering and top/bottom poses checked in browser, compilation OK. Artwork remains pre-rendered, not a volumetric 3D model.
- [x] Create matching tucked-backflip and peeking poses from the approved flying mascot.
- [x] Integrate scroll-linked waving takeoff, 180-degree turns, backflips and three media hideaways.
- [x] Verify targeted tests (11 passing), desktop/mobile/reduced-motion presentation and automatic compilation without publishing.

## Company header and Pay simplification
- [x] Remove Company Mode stickers from shared feature headers, preserving navigation mode indication.
- [x] Hide creator finance summaries and brief/chat banner in Company Pay; retain payment tools and the matching branded Kreto scene.
- [x] Run focused presentation tests (9 passing) and verify build OK; backend and publication unchanged. Authenticated visual verification remains blocked as noted below.

## Landing Match video and scroll navigation
- [x] Preserve native 1440×1800 Match master; lossless fast-start optimization and CDN delivery (HTTP 206 verified).
- [x] Replace scroll dots with theme-aware vertical marks that expand for the active chapter.
- [x] Verify navigation visually, active Match → Studio, targeted test and lossless video decode/hash.
- [ ] Confirm browser playback on a real device — sandbox Chromium lacks H.264 decoding; native source and optimized copy decode successfully with FFmpeg.

## Company mode overhaul
- [x] Synchronize account switching and Company navigation across pages.
- [x] Align Studios, Gigs, Talent and Pay with shared headers and Wrapped surfaces, preserving Creator Studio.
- [x] Add Company signals and complete Menu access.
- [x] Verify targeted tests (23 passing) and public preview; leave production backend and domains unchanged.
- [ ] Verify authenticated Company switching and live hiring/payment flows — blocked: no mintable preview account and legacy authentication unavailable to managed session tooling.

- [x] Simplify Landing chapters and preview cards; align chapter numbering, logo-colored scroll markers, and smooth anchor scrolling

- [ ] Overhaul Today into profile-driven creator intelligence
- [ ] Replace Live and Passport readiness with miniature Holo Passport
- [ ] Integrate Kreto Robot guidance and Kreto Computer floating image
- [ ] Apply explicit CPO document principles without inventing requirements
- [ ] Validate tests and responsive presentation

## Slice K — project creation from brief (guided E2E)
- [x] Guided end-to-end run by Noé on his connected account (noe@kretopia.com): brief text → extraction review (title, 3 deliverables with dates, €4,500 budget, missing moodboard flagged, draft origin) → project created with deliverables/dates/budget intact. Reported "tout s'affiche nickel". No code or backend changes; no automated session available, verification was user-guided.
