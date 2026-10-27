# Roadmap

## Faster public Web search
- [x] Reduce debounce from 900 to 250 ms, show immediate branded progress and source skeletons, share recent public results and in-flight requests, and stream real Web sources before AI ranking finishes; quota, original searchbar and legacy backend preserved.
- [x] 23 focused tests pass; automatic compilation OK and real Landing search verified: feedback 142 ms, first 20 sources 2.292 s, AI completion 3.049 s, repeat search 65 ms with zero additional requests and no page errors. Only the existing Cloud search function deployed; website not published. First-time external searches cannot be guaranteed instantaneous.

## Public discovery, Claim and shared calls
- [x] Web + AI unblocked another way (2026-10-27): public-digital-presence runs on the separate Lovable Cloud backend with server-only switch and service-role-only global quota (30/min, 1500/day); original searchbar shows Kretopia data plus ranked Public web sources. Legacy backend, domain and publication untouched.
- [x] Side Hidden shows more head: media edge moved just past the artwork's straight cut so the full dome and both ear lenses appear.
- [ ] Activation rechecked after Noé confirmed production-environment secret placement at 17:49 UTC: GitHub run 40372225008 still returns HTTP 403 at project visibility, before secret metadata or quota checks. Secret placement is user-confirmed; do not repeat placement advice or infer which permission is missing. Blocker: resolve provider-side access to the exact existing application project; no activation, deployment or data change performed.
- [ ] Resume activation after Noé confirmed replacement of the production access token on 2026-10-26 at 17:39 UTC. Read-only GitHub preflight run 40370749780 completed with a provider HTTP 403 (previous run returned 401); token permissions or access to the existing backend remain unverified. No secret readout, quota installation, activation, deployment or backend/domain switch performed. Blocker: existing backend must grant the stored token access before protected activation can proceed.
- [ ] Execute secure activation authorized on 2026-10-26 after user reports SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID added. Production environment exists; repository/environment secret-name reads return 403. GitHub rejected the read-only preflight upload with an explicit organization OAuth-app restriction. Local preflight prepared; no dispatch, schema change, activation, domain change or deployment. Blocker: organization must authorize the app used by Noé's GitHub API connection; production target and quota still require verification.
- [ ] Complete activation requested again on 2026-10-26: GitHub main now contains public-digital-presence, but reading deployment settings still returns HTTP 403 after reconnecting Noé's GitHub API. Production target, quota installation and server activation remain unverified; do not dispatch an unverified deployment or enable the frontend flag.
- [x] Verify Kretopia/kretopia-connect on GitHub through Noé's connection: main ec7924783202aa37a91b632784c7b93856edcba7; manual Deploy Edge Functions workflow exists and has no prior runs. It deploys functions only, not migrations.
- [ ] Activate approved Web + AI safely on the existing production backend — protected public-digital-presence handler implemented with server-only activation switch, mandatory atomic quota RPC and source-only AI ranking; blocked: no migration tool targets legacy production, quota RPC not installed, production deployment target unconfirmed. No workflow dispatched, no frontend flag enabled, no production/domain/backend switch.
- [x] Share public-safe Kretopia discovery, selection and unverified preview before signup across Auth, Hero, guest topbar and legacy Claim entry.
- [x] Separate source groups and honest unavailable Web state; prepare fail-closed quota policy without activation.
- [x] Change public topbar only to Sign In / Join Kretopia.
- [x] Audit Messages/Studio: already share VideoCallSheet, PersistentStudioCall, provider/host/lobby/controls; preserve implementation and recording.
- [x] Enlarge Side Hidden by apparent helmet scale and locally crop above hips without changing artwork proportions.
- [x] 45 focused tests and focused lint pass; automatic preview build OK. Real public search → selection → preview → signup checked at 1280/885/375px, no overflow/page errors; no publication.
- [x] Prepare source-only Web + AI handler and original-dropdown source rows without activation: 17 focused tests pass, automatic compilation OK; browser confirms one original field and no extra refinement field. Server switch and frontend flag remain disabled.
- [ ] Activate Web + AI in the original searchbar with durable abuse protection — blocked: runtime uses the legacy backend, migration/deployment tools target Cloud only, no external deployment credential is available, and atomic quota RPC is not installed. Do not switch backend or enable the unrestricted legacy crawl.
- [ ] Persist selected-source intent and ownership verification after signup — blocked: needs explicitly approved account/backend handoff; current local intent never verifies ownership.
- [ ] Verify Side Hidden at real chapter edges and live authenticated media — blocked: sandbox scroll did not reach side pose; real calls prohibited in automated tests.

## Today banner prompt deduplication
- [x] Remove the duplicate top "Make your Passport yours" prompt; only the deck-placed banner (aligned with the carousel) remains, plus its Add banner / Not now actions.
- [x] 45 focused Today tests pass, including a new check that the prompt renders exactly once; automatic preview compilation OK. Connected Today page not visually verified — blocked: no automatable legacy session.



## Passport collaboration and stable Holo cards
- [x] Make project/role proposals explicitly subject to the recipient's acceptance through existing invitation workflows.
- [x] Replace the Passport social-sharing card with a branded collaboration CTA on owner/public views.
- [x] Remove pointer-driven Holo inclination globally; 47 focused tests pass and compilation is OK. Isolated light/dark browser checks confirm stable bounds and working proposal/invite callbacks; official logo asset delivery is not verified in sandbox.
- [ ] Verify the connected-account flow on populated Passports — blocked: no automatable legacy session.

## Kreto Computer consistency
- [x] Studio Make uses the same round black feet as the launcher; launcher shares keyboard typing/glow with automatic decorative bursts and unchanged opening action.
- [x] 22 focused tests pass; actual components inspected in isolated light/dark browser view, artwork loaded and reduced motion has zero running animations; automatic compilation OK. Connected Studio account not available for full-page verification. No publication.

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
- [x] Match bottom/Flying helmet size exactly, isolate top glove contours, extend eased emergence, put flight above chapter text/below media and tuck side body behind the edge. 22 tests pass; real Landing scroll shows all four exclusive poses, assets loaded, no runtime errors/overflow at 1280/885/375px, reduced motion respected and automatic compilation OK. Sandbox chapter videos remain undecoded; no publication.
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

## Global performance pass (instant loading)
- [x] Split the 1.2MB entry bundle into cached vendor chunks (react 160K, supabase 220K, motion 114K, i18n 48K; entry now 640K) via manualChunks.
- [x] Non-blocking font loading (Satoshi/Inter preload+swap) and fontshare preconnect in index.html.
- [x] Route prefetch on hover/focus/touch of internal links (src/lib/routePrefetch.ts) for instant navigation.
- [x] Deferred global widgets (NewsletterPopup, PWAInstallPrompt, FeedbackWidget, InteractiveOnboarding) out of the entry chunk.
- [x] Converted the 10 large Kreto PNGs to lossless WebP (4.2MB → 2.9MB, pixel-identical); imports updated in KretoCharacter.tsx and KretoTip.tsx.
- [x] Verified: production build OK, 69 targeted tests pass, browser smoke test (home + /auth) renders correctly, build-errors.log clean.
- [ ] Publish to www.kretopia.com — waiting on Noé's explicit go.

## Guest email-list popup removed
- [x] Deactivate the interruptive "Stay in the Creative Loop" email popup: removed its lazy import and its `{!user && <NewsletterPopup />}` mount from src/App.tsx, because guests mistook it for the sign-up path and it blocked the flow.
- [x] Guard with src/lib/__tests__/noGuestEmailPopup.test.ts (2 tests) — appChrome suite still green (11 total).
- [x] Verified in the live preview as a guest: no dialog and no email field 37 seconds in (past the old 30s timer). Component file kept, unmounted, so it can be revived deliberately.
- [ ] Publish to www.kretopia.com — waiting on Noé's explicit go.
