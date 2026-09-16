# Landing Page Motion, AI Presence and UX/UI — Phase 1 Read-Only Audit

Branch: `feature/reliability-overhaul`. No files edited during this pass.

**Framing note, upfront**: the spec's own language ("blurry dot", implying an unbuilt/primitive landing page) does not match what's actually running. The "landing-v2" rebuild in this repo's git history (commits `1bd4365c` through `9016e9d7`, "Phases 3-13") is real, current, and substantial — an 8-chapter narrative page with a real animated hero, real search, a dynamic-count closing CTA, and comprehensive reduced-motion coverage already in place. This audit treats that as the baseline and identifies what's *actually* missing against this new spec, rather than re-describing what already exists as if it were new work.

## Baseline gate

`npm run typecheck` — clean. `npm run test` — 99/99 passing. `npm run build` — clean (same pre-existing chunk-size warnings as prior passes).

---

## 1. Complete Landing Page section map

`KretopiaLanding.tsx` renders, in order: **`KretopiaHero`** (critical path) → **`LandingBelowFold`** (lazy), which renders `SearchTutorialSection` → `ChapterSection`(Passport) → `VerifiedCreditsChapterSection` → `TrustSection` → `ProductLoopSection` → `ChapterSection`(Scout) → `ChapterSection`(Match) → `ChapterSection`(Studio) → `MeetKretoSection` → `CreativeUniverseSection` → `ChapterSection`(Community) → `ForOrganisationsSection` → `ClosingCTASection` → `EditorialFooter` → then `ChapterProgressNav` (fixed overlay) + `ScrollToTopButton`.

8 numbered chapters (Search/Passport/Verified Credits/Scout/Match/Studio/Kreto/Community per `chapterRegistry.ts`), with unnumbered supporting sections woven between them.

**Dead legacy code still imported in `UnifiedHome.tsx` but never rendered** (protect from accidental revival, don't spend effort fixing): `OneWedgeLanding`, `BottomCTASection`, `ClaimYourCreditsSection`, `ProductReelSection`, `ComparisonTableSection`, `PricingPreviewSection`, `FAQSection`, `CoreValueBlocks`, `SocialProofSection`, `ThriveFundTeaserCard`, `HeroPhoneCarousel`.

## 2. Current heading animation source

`KretopiaHero.tsx:117-152` — real word-by-word framer-motion stagger: each word its own `motion.span`, `staggerChildren: 0.075`, per-word `{opacity, y: 22→0, filter: blur(10px)→blur(0px)}`, `duration: 0.7`, standard ease `[0.2, 0.65, 0.3, 0.95]`. Collapses to a no-op under `prefers-reduced-motion`. No `dangerouslySetInnerHTML` — real text nodes with manually-inserted ` ` between words. **Residual, unverified a11y risk**: no `aria-label` fallback on the `<h1>` guaranteeing screen readers announce it as one sentence rather than word-by-word — structurally likely fine (plain nested inline text, not decorative spans), but not empirically confirmed.

Separately, `src/components/typography/Heading.tsx` (commit `752ad34d`) defines `PageTitle` (the only one with any motion — a simple mount fade+rise, `duration: 0.5`, no stagger, no blur), `SectionHeading`, and `SmartCardTitle` (no motion at all). **None of these three match the hero's actual animation language**, and none are used anywhere near the 11 primary feature surfaces — `PageTitle` has zero usage sites anywhere in the repo; `SectionHeading`/`SmartCardTitle` each have exactly one, unrelated to any nav-level page header.

## 3. Current CTA source of truth

`CtaButton` (`src/components/ui/cta-button.tsx`) is well-defined and documented as canonical — but **has zero usage on the actually-rendered landing page**. Its only consumer, `BottomCTASection`, is dead code (imported, never rendered). Every real landing CTA (`ChapterSection`'s per-chapter button, `ClosingCTASection`'s "Claim Your Creative Passport", `MeetKretoSection`, `ForOrganisationsSection`, `VerifiedCreditsChapterSection`) is a hand-rolled `<Link className="btn-glass ...">`. This is the spec's §9 concern confirmed real.

## 4. Current SearchBar structure

`UnifiedSearchDropdown` (`variant="hero"`), mounted in `KretopiaHero.tsx:197-204`. **Real, not fake**: typing 2+ characters fires live Supabase queries (profiles/credits/opportunities) plus a `universal-search` edge function call; submit calls `search-credits-web` (real edge function), caches results to `sessionStorage`, then navigates to `/auth?tab=signup&claim=1&q=...`. A layout-contract test suite already exists (`UnifiedSearchDropdown.hero.test.tsx`) and must keep passing.

## 5. Current blurry dot implementation

**There is no dot.** What exists is a glow *wrapping the entire search bar* (`KretopiaHero.tsx:169-188`): `-inset-3/-inset-4 rounded-[28px] blur-xl`, pink radial gradient (`#FF2DA1` at 20% alpha), `ai-ambient-breathe` (4s opacity pulse) + a separate `ai-scan-line` top-edge sweep (3.6s). It's `aria-hidden` and **already has one real state**: focus (opacity 60% idle → 100% focused, wired to the input's focus/blur). No typing/submitting/result/error states exist.

**Reuse candidate found**: `KretoAvatar` (`src/components/brand/KretoAvatar.tsx`) already implements a 5-state machine — `idle | thinking | listening | speaking | recording` — used across 13 call sites elsewhere in the app (chat, tips, studio, auth), but **not used anywhere near the hero search bar**. Its states map naturally: listening→focus/typing, thinking→submitting, speaking→result, recording's color-swap→error. This is a real judgment call: building a new "spectrum" from scratch vs. extending this existing, already-brand-established component. **Real gap if reused**: `KretoAvatar` has no internal reduced-motion check — only 2 of its 13 current call sites pass `animated={!reducedMotion}`; the rest default to always-animated. This would need closing regardless of which direction is chosen.

## 6. Current title/eyebrow variants

`.landing-eyebrow` (`src/index.css:901-908`) **defaults to grey** (`rgba(255,255,255,0.5)`) — it only renders pink where a call site passes an inline `style={{color: ACCENT}}` override. The 8 feature-page headers (via `CinematicHeaderPlate`) and the 5 `LandingBelowFold` `ChapterSection` instances all override consistently to pink. But **6 standalone landing sections render grey eyebrows in the same scroll**: `ProductLoopSection`, `TrustSection`, `SearchTutorialSection`, `MeetKretoSection`, `ForOrganisationsSection`, `VerifiedCreditsChapterSection` — plus the feature-tutorial popover (`FeatureAITutorial.tsx`). This is a real, confirmed inconsistency matching the spec's §4 complaint exactly, not a hedge.

`--energy` = `327 100% 59%` = `#FF2DA1` exactly, and `--signal-pink`/`--signal-teal`/`--signal-violet`/`--signal-amber`/`--accent-passport`/`--accent-scout`/`--accent-match`/`--color-accent` are all aliased to the same value (confirmed in `index.css`, consistent with prior session's documented consolidation). **However, `#FF2DA1` is hardcoded directly (not via the token) in 60+ component files** rather than consuming `var(--energy)` — the CSS-level consolidation is real, but most call sites bypass it.

## 7. Files to change (pending your decisions below)

- **CTA standardization**: `ChapterSection.tsx`, `ClosingCTASection.tsx`, `VerifiedCreditsChapterSection.tsx`, `MeetKretoSection.tsx`, `ForOrganisationsSection.tsx` — swap hand-rolled `<Link className="btn-glass...">` for `<CtaButton>`.
- **Eyebrow color fix**: `ProductLoopSection.tsx`, `TrustSection.tsx`, `SearchTutorialSection.tsx`, `MeetKretoSection.tsx`, `ForOrganisationsSection.tsx`, `VerifiedCreditsChapterSection.tsx` — add the same pink override the other 13 sites already use.
- **Forbidden language**: `tutorialContent.ts:30` ("Edit AI-generated content" — live in the Passport tutorial), `MeetKretoSection.tsx:107` ("Not a generic chatbot" — live body copy).
- **AI spectrum**: either extend the existing glow-ring in `KretopiaHero.tsx` with real typing/submitting/result/error states, or reuse/extend `KretoAvatar` next to the search bar — needs your call (see below).
- **Global animated heading system**: extracting the hero's actual word-stagger into a reusable component and applying it to 8-11 real, currently-working feature-page headers is by far the largest, highest-regression-risk item in this entire spec.
- **Join section**: already two-line, already dynamic-count, already collision-free per the audit — likely needs copy wording only, if anything, not a structural fix.

## 8. Files to protect

Payment/Stripe/DB/RLS/auth/navbar (standing rule, unchanged). Additionally: `UnifiedSearchDropdown`'s working search logic and its existing layout-contract test; `KretoAvatar`'s 13 existing call sites elsewhere in the app (if touched for the spectrum, must not regress); `FeaturePageHeader`/`CinematicHeaderPlate`'s current working reveal on the 8 feature surfaces that already share it; the dead legacy landing components (leave unreferenced, don't entangle further).

## 9. Animation performance risks

`KretoAvatar`'s framer-motion animations are JS-driven (WAAPI), **not** covered by the global CSS `prefers-reduced-motion` catch-all — only an explicit `animated` prop gates them, and most call sites don't set it. If reused for the spectrum, this must be wired explicitly. `KretopiaHero`'s two full-section aurora blobs run continuous 18-22s framer-motion loops with no `IntersectionObserver`-based pause when scrolled offscreen — a real, pre-existing gap relevant to this spec's §11.

## 10. Accessibility risks

Hero title's screen-reader behavior is structurally likely fine but not empirically verified (no explicit `aria-label` fallback). `KretoAvatar` reduced-motion gap (above) is a real, pre-existing a11y issue if reused. Eyebrow grey/pink inconsistency is a visual-consistency bug, not itself a contrast failure (not evidenced either way without a live check).

## 11. Responsive risks

Not deeply investigated this pass (static audit) — needs live checks at the spec's 7 breakpoints once implementation scope is confirmed.

## 12. Test plan

Existing `UnifiedSearchDropdown.hero.test.tsx` (layout-contract) must keep passing throughout. No existing tests cover the hero title animation, eyebrow colors, or CTA destinations — any of these would be genuinely new coverage.

## 13. Browser verification plan

Once scope is confirmed: live-check hero animation + reduced-motion fallback, confirm CTA swap preserves every destination/auth-redirect exactly, confirm eyebrow colors are now consistent across the full scroll, confirm spectrum states (if built) at minimum on mobile + desktop viewports.

---

## Open product decisions (need your call before Phase 2 starts)

1. **AI spectrum — build new, or reuse/extend `KretoAvatar`?** Reuse is significantly less net-new design/code and inherits an already-established brand identity, but means fixing `KretoAvatar`'s reduced-motion gap as part of this work. Building new gives more control over the exact "spectral ribbon" look the spec describes but duplicates state-machine work that already exists.
2. **Global heading system scope**: extract the hero's real word-stagger animation into a shared component and apply it to how many of the 11 feature surfaces? This is the single largest, highest-regression-risk item here — each surface currently has a real, working header. A phased/contained rollout (e.g., landing sections only first) vs. the full 11-surface unification the spec asks for is a real scope decision, not just an implementation detail.
3. **Eyebrow fix approach**: patch the 6 grey call sites individually (surgical, lower risk), or flip `.landing-eyebrow`'s own default to pink (fixes it everywhere at once, but changes a shared class 13+ other call sites already override anyway — need to confirm no site relies on the grey default intentionally, e.g. `EditorialChapter.tsx`/`About.tsx` explicitly override to `text-white/55`, suggesting grey-on-purpose exists elsewhere too).
4. **Join section**: given it's already structurally correct (two lines, dynamic count, no overlap), is there anything concretely broken here, or does this item drop off the list entirely?

Waiting for your explicit confirmation (and answers above) before any Phase 2 editing begins.
