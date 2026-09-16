# Kretopia — Landing & VideoCall QA Report

Scope: Phases 2–10 of the production hardening pass.
Branch: current working tree. `main` untouched by this pass.
Date of run: see git log for the phase commits.

---

## 1. Files changed

### VideoCall (Phase 2)
| File | Change |
|---|---|
| `src/lib/dailyFrame.ts` | `@daily-co/daily-js` moved from static to cached dynamic import (`loadDaily()` / `prefetchDaily()`). Added `teardownDailyCall()` for deterministic track + frame release. Async `destroyExistingDailyFrameAsync()` awaits the singleton destroy before a new frame is created. |
| `src/lib/callPreflight.ts` | Preflight no longer pulls the SDK into the initial bundle; browser-support probe loads Daily on demand. |
| `src/pages/CallPage.tsx` | Uses `createDailyFrameAsync`; `teardownDailyCall` on unmount. |
| `src/pages/GuestCall.tsx` | Same async create + teardown path. |
| `src/hooks/useStartDirectCall.ts` | `inFlightRef` guard makes call creation idempotent against double-clicks/re-entry; `prefetchDaily()` warms the SDK only after a room is confirmed. |

### Landing (Phases 3–9)
| File | Change |
|---|---|
| `src/components/landing/KretopiaHero.tsx` | Search-first hierarchy: eyebrow → headline → one supporting sentence → dominant search → "Search my name" (primary) → "Create my Passport" (secondary). Portrait image between headline and search removed; spacing rebalanced. Reuses the app's real `UnifiedSearchDropdown` — no second search engine, no fake result animation. |
| `src/App.tsx` | Removed the intrusive `GuestBanner` popup ("Claim your credits, land real gigs"); removed the now-dead `publicBrowseRoutes` state it fed. No replacement popup added. |
| `src/index.css` | Standardized landing type scale: `.landing-eyebrow`, `.landing-h1`, `.landing-h2`, `.landing-sub`, `.landing-glow`, `.landing-section`. `.landing-glow` is a low-opacity `#FF2DA1` text-shadow, disabled under `prefers-reduced-motion`. |
| `src/components/landing/kretopia/AuditionRoadmapSection.tsx` | **New.** 8-step audition roadmap (Create & Share → Connect After) as a vertical stepper with an IntersectionObserver progress rail. |
| `src/components/landing/kretopia/MeetKretoSection.tsx` | Rewritten as the Executive Producer section: new hierarchy, 6 capability items, restrained glass command surface, example prompts, explicit AI-assisted labelling. |
| `src/components/Navbar.tsx` | Icons added to Verified Credits, Spotlight, About Us, Hire Talent, Sign In, Get Started (desktop + mobile sheet); `aria-hidden` on icons, `aria-current="page"`, `#FF2DA1` active state. Sign In added to the mobile sheet. |
| `src/components/landing/kretopia/LandingBelowFold.tsx` | **New.** Everything after the hero, isolated into one lazy chunk. |
| `src/components/landing/KretopiaLanding.tsx` | Hero stays on the critical path; below-fold chunk mounts on an IntersectionObserver sentinel (`rootMargin: 100%`) or `requestIdleCallback` (2.5s timeout), whichever fires first. Height-reserving placeholder prevents layout shift. |

---

## 2. Security findings

No new security-relevant code was introduced by this pass. Specifically:

- No RLS policy, migration, auth, payment or secret was modified.
- No service-role key, provider credential or meeting token is referenced from client code touched here. Daily meeting tokens continue to be minted server-side in edge functions and are never logged by the client paths changed.
- Call diagnostics added log lifecycle/state only (creation start/success/failure, teardown, error message). No tokens, no room secrets, no personal data.
- The removed `GuestBanner` had no auth role; removing it changes no access control.
- Landing CTAs all point at real, existing routes (`/auth`, `/auth?next=…`, `/scout`, `/credits`, `/spotlight`, `/about`, `/post-opportunity`). Anything requiring an account routes through `/auth?next=` rather than deep-linking a protected page.

Outstanding items from the Phase 1 audit that require manual/product decisions (not fixed here, unchanged by this pass): none newly discovered.

---

## 3. VideoCall root cause

Three distinct defects, all reproducible:

1. **Slow start / landing weight** — `@daily-co/daily-js` (~244 KB minified) was statically imported at the top of `src/lib/dailyFrame.ts` and `src/lib/callPreflight.ts`. Both are shared libraries reachable from the app shell, so the SDK was linked into the main entry chunk and parsed on every page load, including the landing page. Fixed by dynamic import with a cached module promise.

2. **Duplicate call creation** — `useStartDirectCall.start()` guarded only on a React state flag (`starting`), which does not update synchronously. A fast double-click issued two `create-direct-video-call` invocations, producing two rooms and two ring broadcasts. Fixed with a synchronous `inFlightRef` guard.

3. **"Duplicate DailyIframe instances are not allowed" / postMessage on null** — Daily's destroy is asynchronous. React StrictMode double-mount, HMR and route changes could call `createFrame` before the previous singleton finished tearing down. Fixed by awaiting `destroyExistingDailyFrameAsync()` and by `teardownDailyCall()` on unmount, which also explicitly disables local video/audio before leaving so camera and mic tracks are released.

---

## 4. Performance before / after

Production build (`vite build`):

| Metric | Before | After |
|---|---|---|
| Daily SDK location | inside main entry chunk | own chunk `daily-esm-*.js` (244 KB), loaded only on a call route |
| Main entry chunk | ~1.9 MB raw | ~1.8 MB raw (≈568 KB gzip) |
| Landing below-fold JS | in the entry chunk | `LandingBelowFold-*.js`, 21 KB, deferred |
| 5 chapter JPEGs | requested during initial load | deferred with the below-fold chunk, plus `loading="lazy"` + explicit `width`/`height` |

Dev-server interaction readiness (Playwright, unbundled — indicative only, production will be faster):

| Viewport | Time until the search input accepts typed text |
|---|---|
| Desktop 1280×900 | 1693 ms |
| Mobile 390×844 | 1558 ms |
| Desktop, reduced motion | 1603 ms |

No layout shift was observed from the deferral: the placeholder reserves `min-h-[60vh]` and chapter images sit in fixed aspect-ratio containers.

---

## 5. Routes tested

`/` (landing, guest) — desktop and mobile. Navbar guest links resolve to `/credits`, `/spotlight`, `/about`, `/post-opportunity`, `/auth`, `/auth?tab=signup`. Audition CTAs resolve to `/auth?next=/desk` and `/scout`. Kreto CTAs resolve to `/auth?next=/circle`.

---

## 6. Search states tested

Search on the landing page is the shared `UnifiedSearchDropdown` (`variant="hero"`), the same component used by the Navbar, Home and the other landing surfaces — so its debouncing, request cancellation, keyboard navigation, voice input and result states are the app's existing, already-exercised behaviour, not a reimplementation.

Verified on the landing hero: empty state, typing (`test` accepted, value echoed back), Escape dismiss, focus and click targets on both viewports. No fake/placeholder results are rendered at any point; result rendering is entirely delegated to the shared component.

---

## 7. Microphone / permission states

- Landing page requests **no** microphone or camera permission on load. Voice search is inside the shared search component and only initialises on explicit user action.
- VideoCall requests media only after an explicit user action; the SDK itself is not even downloaded until then.
- `teardownDailyCall()` disables local video and audio before `leave()`/`destroy()`, so no camera or mic remains active after leaving a call.
- Permission-denied handling and the in-app-browser / insecure-context / unsupported-browser fallbacks live in `src/lib/callPreflight.ts`, each with a human-readable reason and a copy-link CTA.

---

## 8. Results

**Automated**
- Typecheck (`tsgo --noEmit -p tsconfig.app.json`): pass, 0 errors.
- Unit tests (`vitest run`): 5 files, 62 tests, all passing.
- Lint on `src/components/landing/**`: 0 errors, 0 warnings. The pre-existing `no-explicit-any` / `no-empty` / `no-unused-expressions` errors were cleaned up in Phase 11 (see below). Two long-standing `no-explicit-any` spots remain in `Navbar.tsx`, outside this pass's scope.
- Production build: succeeds.

**Desktop (1280×900 / 1280×1800)**
- Landing renders end to end; 0 uncaught page errors.
- Audition roadmap and Kreto section present and correctly laid out.
- Below-fold chunk loads on approach; full page height ~10.7k px.

**Mobile (390×844)**
- Landing renders end to end; 0 uncaught page errors.
- Stepper collapses to a single column and stays readable; icons and rail align.
- Full page height ~10k px; scrolling to the audition section works.

**Reduced motion**
- `useReducedMotion` short-circuits the stepper reveal (renders fully visible immediately), stops the Kreto line rotation, disables framer-motion entry offsets, and `.landing-glow` drops its text-shadow. Verified with Playwright `reduced_motion="reduce"`.

**Accessibility**
- All decorative icons carry `aria-hidden`; no icon replaces a text label.
- Active nav item exposes `aria-current="page"`.
- Roadmap is a semantic `<ol>` with `aria-labelledby` on the section; Kreto section likewise.
- Nav and CTAs are real links/buttons, keyboard reachable and focusable.

---

## 9. Known limitations

- Interaction-readiness numbers above are from the dev server (unbundled ES modules with per-file requests). They are useful only as a relative before/after signal, not as production timings.
- Automated call testing is limited to code paths and cleanup; a real two-party call over the Daily provider still needs a manual pass on physical devices. Provider-side issues (TURN reachability, regional capacity) cannot be diagnosed from this repo.
- Browser matrix covered automatically is Chromium only. Safari/iOS and Firefox behaviour for `getUserMedia` and in-app webviews relies on the `callPreflight` heuristics, which are best-effort user-agent and capability probes.
- Some chapter imagery is still large; further gains are available by serving AVIF/WebP variants.

## 10. Manual actions still required

1. Run one real end-to-end call on iOS Safari and Android Chrome (create → join → leave → rejoin) and confirm the camera indicator turns off on leave.
2. Re-run Lighthouse against the **published** build for real LCP/TBT numbers.
3. None outstanding for the landing pass.

---

## 11. Phase 11 — dead code and lint cleanup

**Deleted (verified zero references anywhere in `src/`):**
`src/components/landing/HeroSection.tsx`, `ActivityFeed.tsx`, `PillarMockups.tsx`, `ComparisonSection.tsx`, `CloseSection.tsx` — all superseded by the `src/components/landing/kretopia/*` editorial sections.

**Typed properly (no behaviour change):**
| File | Fix |
|---|---|
| `SocialProofSection.tsx` | `supabase.functions.invoke<{ stats?: … }>("public-stats")` replaces `(data as any).stats`. |
| `OneWedgeLanding.tsx` | Same generic on `public-stats`; `featured` and `stats.creators` now read type-safely. |
| `DiscoverCreativesRow.tsx` | `(supabase as any).rpc(...)` replaced with a narrowly typed cast returning `Creator[] | null`. |
| `WaitlistForm.tsx` | `catch (error: unknown)` with an `instanceof Error` narrowing; toast copy unchanged. |
| `OAuthQuickButtons.tsx` | Ternary-as-statement replaced with an `if/else`. |

Post-cleanup: typecheck clean, 62/62 tests pass, landing renders with 0 page errors on desktop and mobile, and the first Tab now lands on "Skip to main content".
