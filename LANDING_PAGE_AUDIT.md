# Landing Page Audit

Baseline: `tsc --noEmit` clean, `npm run build` succeeds, `eslint .` at the established baseline (3496 problems / 3186 errors / 310 warnings — same figure Charter C ended on, confirming no drift since). No `typecheck` or test script exists in `package.json`.

## Route mapping

`/` → `App.tsx`'s `DefaultRoute` → for a signed-out visitor, renders `UnifiedHome` (`src/components/home/UnifiedHome.tsx`), which for `!user && !authLoading` renders `KretopiaLanding` (`src/components/landing/KretopiaLanding.tsx`) — **this is the actual landing page**. `UnifiedHome` also contains a large amount of authenticated-only code (Today feed, matches, briefing cards, etc.) that never touches a guest — not in scope for this charter, not touched.

`KretopiaLanding` is a 9-chapter editorial scroll: **I. Hero** (`KretopiaHero.tsx`) → II. Manifesto → III–VII. five feature chapters (Passport/Scout/Match/Studio/SoundStages, each its own accent color and image) → VIII. Meet Kreto → IX. Closing → Footer.

## Current hierarchy (Hero — the actual charter target)

1. Eyebrow: "Kretopia · An Operating System for Creative Careers"
2. Headline (huge, `clamp(2.75rem, 8.5vw, 7.5rem)`, serif): **"Welcome to Kretopia. Where creativity lives."**
3. Sub-copy: **"Talent is everywhere. Opportunity is not. Kretopia exists to close that gap."**
4. Full-bleed portrait image (right column, desktop) / stacks below on mobile
5. *(large vertical gap — `mt-16 sm:mt-24 lg:mt-28`)*
6. "Begin" eyebrow → "Search your name." sub-heading → one line of body copy → **the search input**

**This is close to a byte-for-byte match of the charter's own "do not display as one large awkward text block" example** — confirms the charter's premise is accurate, not a hypothetical.

## Current primary CTA

There is no single CTA button competing with search — the hero's only interactive elements are the search input and its "Find me" submit. That part is already correct. The problem is entirely **hierarchy and position**: the search doesn't become the visual center until after a full headline+portrait block has already been read, and on mobile that means significant scrolling before reaching it.

## Current search behavior — two separate, inconsistent implementations

1. **`KretopiaHero.tsx`'s actual input** (what renders today): a plain, hand-rolled `<input>`. On submit, calls `onSearchSubmit` (passed down from `UnifiedHome` as `handleHeroClaimSearch`), which prefetches `search-credits-web`, caches results in `sessionStorage`, and navigates to `/auth?tab=signup&claim=1&q=...`. **No microphone button. No live suggestions. No dropdown. No empty/typing/found/unclaimed/no-result/error states visible on the page itself** — all of that only happens after navigating away to `/auth`.
2. **The component's own doc comment is stale/wrong**: line 10 says *"real search wired to the existing UnifiedSearchDropdown → /auth claim flow"* — this is not true of the current code. `UnifiedSearchDropdown` is never imported in this file. This is exactly the kind of stale-copy/component-drift the audit was asked to find.

## The real search architecture already exists — and already does almost everything the charter asks for

`src/components/search/UnifiedSearchDropdown.tsx` (965 lines, used by `Navbar.tsx`, `SearchV2.tsx`, `CreditDatabase.tsx`, `ClaimYourCreditsSection.tsx`, and `OneWedgeLanding.tsx` — a retired landing variant) already has:
- A `variant="hero"` mode (bigger input, glass surface, glow-on-focus) — **built, just not used by the current hero**.
- Voice search fully wired: `useVoiceSearch` (`src/hooks/useVoiceSearch.ts`) + `VoiceWaveform` (`src/components/search/VoiceWaveform.tsx`) — real `getUserMedia`/`MediaRecorder` push-to-talk, permission requested only on click, real `AnalyserNode`-driven waveform (not a generic loop), full `unsupported/idle/requesting/recording/processing/denied/error` state machine, auto-dismissing error toast, proper cleanup/no-background-recording on unmount.
- Debounced search (350ms), `AbortController`-based stale-request cancellation, parallel DB queries (profiles/credits/opportunities, with fuzzy letter-swap variants) + a `universal-search` edge function for AI/web results, all rendered with type badges (Creator/Credit/Gig/Discovered).
- A highlighted-creator preview with real recent credits.
- Full keyboard nav: Arrow Up/Down moves through results, Enter selects, Escape closes and stays closed (guards against instant re-open on refocus).
- Distinct loading / error (with retry) / "No results found" / results states already implemented.
- A "Deep search" footer action.

**Conclusion: this charter's Phase 2–4 work is very substantially a matter of swapping the hero's hand-rolled input for `<UnifiedSearchDropdown variant="hero" />`, not building new search/voice infrastructure.** The one real gap: `UnifiedSearchDropdown`'s copy (e.g. "No results found") is generic/shared across navbar+landing+other contexts — the charter's specific landing-page microcopy suggestions are better applied as page-level framing text around the shared component, not as edits to the shared component's internals (which would also change the authenticated in-app search's copy, an unrelated surface this charter shouldn't touch).

## Current performance risks

- Chapter images (`chapter-passport.jpg` 152KB, `chapter-scout.jpg` 173KB, `chapter-match.jpg` 174KB, `chapter-studio.jpg` 239KB, `chapter-soundstages.jpg` 261KB) already use `loading="lazy"` in `ChapterSection.tsx` — **already correctly handled**, not a real issue.
- Hero portrait (`kretopia-hero-portrait.jpg`, 95KB) is above-the-fold and correctly NOT lazy (would cause a flash-in); no `fetchpriority` hint set — a real, cheap, safe optimization opportunity.
- `KretopiaHero.tsx` uses `framer-motion` for entrance animations — already a project-wide dependency (used throughout the app), not a new bundle cost.
- The hero's rotating-name ghost text (`setInterval` every 2600ms) and `UnifiedHome`'s rotating hero-role interval (2500ms) both run continuously for as long as a guest sits on the page — harmless CPU-wise but worth folding into the reduced-motion audit.
- `UnifiedHome` itself is not lazy-loaded at the route level (direct import in `App.tsx`) — correct for the site's actual entry route, not a bug.

## Current copy problems (beyond the headline)

- The "Begin" eyebrow + "Search your name." heading + body paragraph, stacked above the input, add three more read-steps before the input itself — contributes to the "understand in 5 seconds" failure the charter names.
- "Free. No card. Built for creators." trust line below the input is fine and can stay.

## Current responsive problems

Not yet measured against the charter's specific breakpoints (1280/1440/375/390/430) — deferred to Phase 8's explicit QA pass rather than guessed here.

## Components to keep (as-is, not touched this charter)

- `ManifestoSection`, all five `ChapterSection` instances (Passport/Scout/Match/Studio/SoundStages), `MeetKretoSection`, `ClosingSection`, `EditorialFooter` — the "editorial spine" below the hero. Per the charter's own Phase 5 instruction ("refine... instead of replacing," "keep the strongest existing sections") and the established precedent from the earlier design-system work this session (public marketing/landing editorial content was explicitly carved out as its own category, left alone) — **the per-chapter accent colors (`#9413D2` purple, `#FFC72C` amber, `#FF0A78` magenta, `#FF8C42` orange) are a deliberate existing design choice for this narrative section, not touched.** This is the one place in the whole app where "single accent only" is knowingly not being enforced by this charter — recorded here explicitly rather than silently left inconsistent. The charter's own accent rules (Phase 2/7) are scoped to the searchbar/CTA/focus states, which this audit reads as Hero-specific, not "recolor the whole page."
- `UnifiedSearchDropdown.tsx`, `useVoiceSearch.ts`, `VoiceWaveform.tsx` — reused, not rebuilt.
- Global `Navbar.tsx` — not touched, so "no Navbar regression" is trivially satisfied.

## Components to refine

- `KretopiaHero.tsx` — copy rewrite (Phase 1), structural reorder so search is dominant (Phase 2), swap the hand-rolled input for `UnifiedSearchDropdown variant="hero"` (Phase 2–4), fix the stale doc comment.

## Components that are genuinely redundant

- None deleted. `OneWedgeLanding.tsx` (an older landing variant using `UnifiedSearchDropdown` directly) and `useLandingVariant()` (computes an `isWedge` flag in `UnifiedHome.tsx` that is computed but never actually branches any rendered JSX — `KretopiaLanding` renders unconditionally for guests) appear to be dead/legacy code from a prior landing iteration. Flagged, not deleted — deleting dead code is a separate discipline from a copy/hierarchy pass, and `isWedge` being unused doesn't affect anything currently rendering, so there's no user-facing bug to fix by removing it.

## Rollback plan

Every phase lands as its own commit on `feature/creative-passport-rearchitecture`, verified with `tsc`/`eslint`-diff/`build` before commit. No schema/RLS/auth/payment changes anywhere in this plan, so the only rollback surface is git history.
