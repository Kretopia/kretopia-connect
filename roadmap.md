# Roadmap

## Kreto Landing flight
- [ ] Lock both ledge poses to every media edge in both scroll directions, remove residual animation and verify threshold jitter without publishing.
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
