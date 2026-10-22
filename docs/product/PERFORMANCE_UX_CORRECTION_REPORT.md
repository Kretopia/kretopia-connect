# Performance and UX correction pass: report (2026-10-22)

Branch `fix/performance-ux-correction-pass`, committed locally, **not pushed, not deployed, not published**. No migration, no database or Edge Function change, no backend logic, no new dependency, no route, API, permission or data-model change. `extract-brief` and the duplicate-project work were left alone (that work is paused; its patch is kept outside the repo).

## Status by item

| # | Item | Status | Result |
|---|------|--------|--------|
| 1 | Performance | **done where measurable** | Landing, first load on a phone, production build: **3,405 KB to 547 KB** (the 2.86 MB first-chapter video no longer downloads at load); layout shift 0. New Room's JavaScript chunk: **517 KB (155 KB gzip) to 60 KB (19 KB gzip)**. |
| 2 | Scout | **partial** | Closing date on gig cards (only when the data has one that has not passed), empty states that say why and what to do, a note on why Open Gigs is in the order it is. No new opportunities, no new source. |
| 3 | EPK branding | **done, palette to confirm** | No pink on the EPK page or in the press kit PDF. The PDF palette named in the brief is not in the repo, so the app's own tokens were used (see TODO). |
| 4 | Passport divider and unity | **partial** | The divider below "Last 30 days" and the rule above it are gone. The Holo hero and the overview are still two components. |
| 5 | Holo cards | **done, verified with a real pointer** | Original tilt and following sheen restored at lower depth; corner jitter checked on two corners with a real mouse. |
| 6 | VideoCall | **done in CSS and markup, not seen in a live call** | Branded Start call in the lobby; miniature sized by aspect ratio. |
| 7 | Settings sidebar | **done, verified** | Sidebar is sticky; the Wrapped frame no longer traps it. |
| 8 | Search modal | **done, verified** | Light glass panel under the navbar on a strongly blurred page. |

## 1. Performance
Measured on a production build (`vite build` + `vite preview`), the real `/landing` at 375px, page at the top.
- **First-chapter video.** It had `preload="auto"` and `autoplay`, so 2.86 MB started downloading at 138 ms although that chapter sits almost two screens down. On a phone (`max-width: 767px`) or with data saver on, it now waits like the other chapters: metadata only, full download one screen before it is reached, starts when it comes into view. On a wide screen nothing changes (the repo rule of fetching the first chapter without waiting is kept there). First load: 3,405 KB to 547 KB.
- **`pdfjs-dist`** was imported at module scope by `extractBriefDocument.ts`, so New Room (and the Studio code that shares it) carried a 458 KB PDF library to resize an image. It now loads on first PDF read. New Room chunk 517 KB to 60 KB; the library is its own chunk.
- **Posters:** not added. `AGENTS.md` says chapter videos are served without posters (a still flashes and delays playback), and the hero has no video. **No video was re-encoded**, no CDN, provider or analytics added.
- Already in place and unchanged: lazy routes, one autoplaying chapter at a time (earlier PR), near-viewport promotion, explicit media boxes (layout shift 0).
- **Not done:** the main entry is 1.38 MB (428 KB gzip) and the Studio chunk 824 KB (203 KB gzip); both need a bundle analysis, not a guess. Passport, Scout, Studio and VideoCall load times were not measured (they need a signed-in session).

## 2. Scout
- Gig cards show "Closes Nov 12" when `application_deadline` is real and in the future (`closingLabel`, 6 tests); nothing is shown otherwise. Skills (up to four), compensation, location and the Apply action were already on the card. **Timezone is not stored**, so it is not shown.
- Empty states: For You says Scout lists only gigs that fit the Passport and links to "Add your role" when it is missing; Shortlist offers "See gigs for you"; an empty Open Gigs points to For You; a note explains that Open Gigs is in posting order until the Passport has a role or skills.
- "Increase the number of opportunities shown" was **not** done: no extra real data exists to show, and the brief forbids inventing or adding sources.
- Scan now stays the first action; the free-tier sentence is not in the code. For You is profile-matched, Open Gigs is ordered by the existing fit (earlier pass), Shortlist is the person's own saved gigs.

## 3. EPK
- Public page: the title accent is the page's foreground colour (no pink, no gradient).
- Press kit PDF: Editorial and Pure Black use the brand's Signal Teal (`#17D9D4`), Editorial Light uses the same teal deepened to `#0A7673` for contrast on white; the editor starts on `#17D9D4`; the QR no longer ends in pink. Every accent keeps WCAG AA on its own canvas. Tests assert the teal family, no violet and no flashy pink among the palettes and among every colour the generator paints.
- **Correction (2026-10-22, follow-up):** the first version of this pass used white and ink because the brand PDF was not in the repo. It is `~/Desktop/KRETOPIA/Kretopia_Feature_Bible_v1.pdf`, section "the brand in one page": Signal Triad Magenta `#FF0A78`, Yellow `#FFC72C`, Teal `#17D9D4` ("accent only, never structural"), surfaces Midnight `#05070D`, Card `#11141B`, Elevated `#1A1E28`, Muted `#A8B0C0`, and **one dominant accent per surface: Passport and Credits are Teal**, Scout and Kreto Yellow, Match and Messages Magenta. The EPK is the Passport's external face, so teal is the accent; the public title uses a new `--passport-accent` token (teal on dark, deeper teal on light, falling back to the foreground colour). The "Palette Aligned" deck and the business cards were also read: midnight, white, grey and the logo gradient as the only highlight, consistent with this.
- **Not verified:** the generated PDF was not opened in a viewer (colours were checked by recording what the generator sets).

## 4. Passport
Removed the rule below "Last 30 days" (the `border-t` on "Recently worked with") and the rule above the momentum block; blocks are spaced. The hero (Holo card) and "Passport intelligence" remain two components with one gap and the same radius.

## 5. Holo card audit
- 22 files import the shared `HoloCard`; no second implementation. Callers keep their own `maxTilt` (3 to 5) and `glow`.
- Restored: pointer tilt (5° default, was 8°), a sheen that follows the pointer, theme-aware foil colours (kept from `main`), glow layer 24px behind (was 40px), softer shadow. Transform and opacity only; touch and reduced motion stay flat.
- Corner jitter: the pointer is tracked on the stable wrapper, not on the tilted card, which removes the feedback loop. **Checked with a real mouse** resting on the top-left and bottom-right corners of a real card: one distinct transform over the last second, zero flip-flops, wrapper never moved, leaving resets the card flat. A mutation putting the handlers back on the tilted element fails 2 of 9 tests.
- Note: `main`'s `HoloCard` had been changed to never tilt. This pass reverses that on purpose, as asked; confirm it is wanted.

## 6. VideoCall
- Lobby "Start call": a concise glass pill with the logo-gradient ring (`k-cta-future`, the Landing's primary CTA treatment) and a camera icon, instead of a full-width black-and-white bar. Call logic, permissions and the header's own "Start call" button are untouched.
- Miniature: sized by shape, 16:9 on desktop (360 x 203, was 320 x 160) and 4:3 on phones (240 x 180, was 108px tall), capped to the page. Measured in a harness. **Not seen with a live Daily call**: how Daily fits a screen share inside the box is unverified.

## 7. Settings
At 1100 x 700 the sidebar started at 583px and ended at 819px (three of six sections visible) and, not being sticky, scrolled away from a 1,136px content pane. It is now `sticky` (`top-20`, below the navbar). `WrappedShell` used `overflow-hidden`, which makes `sticky` bind to itself; it now uses `overflow-clip` (same clipping and radius, verified). On arrival at 700px high, three of six show until the first scroll; after any scroll all six stay visible. Checked at 1100, 780 and 375px, no horizontal scroll.

## 8. Search
The navbar search is a top `Sheet` over a `bg-black/80` scrim with no blur. `SheetContent` now takes an optional `overlayClassName`; the search uses `bg-background/20 backdrop-blur-2xl` (40px), and the panel is a 44rem glass card under the navbar (`top: 4.25rem`) with a 40px blur of its own. Verified on the real Landing: panel 704 x 121 at desktop, 351 x 113 on a phone, input focused, Escape closes it, no horizontal scroll. Results rendering was not changed and was not exercised (it queries live data).

## Files
Created: `docs/product/PERFORMANCE_UX_CORRECTION_REPORT.md`, `src/components/opportunity/__tests__/closingLabel.test.ts`.
Modified: `src/components/Navbar.tsx`, `ui/sheet.tsx`, `wrapped/WrappedShell.tsx`, `settings/SettingsNav.tsx`, `passport/HoloCard.tsx`, `PassportOverview.tsx`, `RecentlyWorkedWith.tsx`, `profile/PublicProfileWrapped.tsx`, `epk/EPKPdfEditor.tsx`, `project/PreCallLobby.tsx`, `opportunity/GigCard.tsx`, `ScoutedGigsSection.tsx`, `ShortlistedGigs.tsx`, `circle/OpportunitiesFeed.tsx`, `landing/kretopia/ChapterSection.tsx`, `src/pages/Scout.tsx`, `src/lib/epkPdfGenerator.ts`, `extractBriefDocument.ts`, `src/index.css`; tests: `HoloCard`, `ChapterVideo`, `PublicProfileWrapped`, `epkPdfPalette`, `epkPdfColours`.

## QA checklist
Run: `tsc -p tsconfig.app.json` exit 0; full suite on this branch with Node's experimental web storage off: 2,435 passed, 1 failed (`VoiceFirstCreateModal` "How this works", already failing on `main`); ESLint error counts equal to `HEAD` on every touched file; production build exit 0. Browser: Landing first-load weight and layout shift (375px); search panel (1300 and 375px, dark, Escape); Settings sidebar (1100, 780, 375px); Holo corners with a real pointer; lobby button and miniature sizing (1300 and 375px, harness); Today and chapter videos earlier. All in the dark theme.
Not run: Passport EPK and unified layout, Scout tabs and cards, Studio, New Room and a live VideoCall in a signed-in session; light theme; tablet captures other than Settings; console errors on the affected routes; opening the generated PDF; Passport, Scout, Studio and VideoCall load times.

## TODOs
1. ~~Brand palette PDF~~ found and applied (see item 3). Open question for the owner: the app's tokens turned `--signal-teal` into the white accent ("mainly white" rollback) while the brand guide still assigns teal to Passport; the guide is followed here for the EPK only.
2. Analyse the 1.38 MB main entry and the 824 KB Studio chunk.
3. Signed-in pass: Scout cards and empty states, Passport, Studio, New Room, a real call (lobby, miniature, screen share).
4. `VoiceFirstCreateModal`'s "How this works" trigger was removed upstream and its test still expects it; decide which is right.
5. Tests failing only on a Mac running Node 26 pass with `NODE_OPTIONS=--no-experimental-webstorage`.

## Rollback
One commit; `git revert` restores everything. Per area: `HoloCard.tsx`, `ChapterSection.tsx` (`eager`), `extractBriefDocument.ts` (`loadPdfjs`), `SettingsNav.tsx` + `WrappedShell.tsx` (`overflow-clip`; revert both together), `sheet.tsx` + `Navbar.tsx` + `index.css` (search), `PreCallLobby.tsx` + `index.css` (call), `epkPdfGenerator.ts` + `PublicProfileWrapped.tsx` (EPK), the Scout files.

## Decisions taken (2026-10-22, by judgment, as delegated)
- **First chapter video waits on phones and with data saver: kept.** It saves 2.86 MB on a phone's first load, the chapter sits about a screen and a half down, its download starts one screen before it is reached, and desktop keeps the repo's "first chapter without waiting" behaviour. Confirmed live: no video downloads on a phone's first load.
- **Holo tilt restored: kept.** It was asked for explicitly, and it was checked with a real pointer on two corners locally and on a large live card (4.96, -4.92 degrees, one distinct value over a second, no flip-flops, card never moves).
- **`WrappedShell` `overflow-clip`: kept, with a fallback.** Same clipping and radius; browsers without `overflow: clip` (Safari before 16) now get `overflow: hidden` through an `@supports` rule, so nothing regresses there; only the sticky Settings sidebar needs the new behaviour.
- **EPK palette: changed to the brand's Signal Teal** (see item 3).
- **Not possible for me:** a signed-in look at Scout, Passport, Settings and a live call. The browser pane is signed out, Scout shows a blurred sign-up gate to guests, and I do not enter credentials. The public EPK page was checked live instead (title colour, no pink, Holo corners).

## Publish-readiness decision required
Nothing is published. To ship: merge, then publish the frontend; no function paste or database step. Decide first on (a) first-chapter video waiting on phones (a deliberate trade against the `AGENTS.md` "prioritize the first chapter" rule), (b) the shared `WrappedShell` `overflow-clip` change, (c) restoring the Holo tilt that `main` had removed, (d) the EPK palette until it is compared with the PDF, and (e) a signed-in check of items 2, 4 and 6.

## Bundle audit (2026-10-22, production build of main at 7ae1bba68)

Measured with a throwaway config (not committed) that reads each chunk's modules; sizes are minified, gzip from `zlib`. "Composition" numbers are pre-minification, so read them as proportions.

| Chunk | Raw | Gzip | Notes |
|---|---|---|---|
| Entry `index-*.js` (every first load) | 1,329 KB | 409 KB | no static imports besides itself; no modulepreload |
| `Discover` | 1,611 KB | 446 KB | almost all `mapbox-gl` (route chunk, only on /discover) |
| `ThriveDesk` (Studio) | 804 KB | 198 KB | `src/components/project` plus `tus-js-client` (97 KB) |
| `index-A2G5l93D` | 366 KB | 107 KB | `html5-qrcode`, lazy |
| `pdf`, `jspdf`, `html2canvas`, `daily-esm` | 448 / 379 / 198 / 243 KB | 132 / 123 / 47 / 67 KB | all lazy |

Entry composition: `framer-motion` 331 KB, **Sentry (replay 294, core 289, browser-utils 114, browser 92)**, `@supabase/auth-js` 162, `react-dom` 131, `i18next` 80, `realtime-js` 75, `tailwind-merge` 70.

**Done (branch `perf/bundle-audit`, not pushed):** the Sentry SDK was a static import of `main.tsx`, but production has no `VITE_SENTRY_DSN`, so it initialised nothing. `initSentry()` now returns before importing it unless there is a DSN and the build is production, and imports it dynamically otherwise. Entry: **1,329 to 1,079 KB raw (-250 KB), 409 to 327 KB gzip (-82 KB, -20%)**. Behaviour with no DSN is identical (no events were sent before either). With a DSN, the SDK starts after one chunk fetch instead of synchronously, so errors thrown in the first few hundred milliseconds are not captured; the Replay masking options and sample rates are unchanged and still tested. Guard test fails if a static `@sentry` import comes back.

**Not done, by judgment (each is a refactor or a behaviour decision, outside "surgical"):**
1. `framer-motion` is 331 KB of the entry. `LazyMotion` with `domAnimation` and `m.*` would cut most of it but touches every file that animates. Worth its own pass with a visual check.
2. `mapbox-gl` (about 1.6 MB) loads with the Discover route. Loading it only when the map is shown would help that route; it needs a signed-in look to confirm the map is not the first thing people see.
3. The service worker precaches 424 entries (10.7 MB). Workbox owns that policy (AGENTS.md); not touched.
