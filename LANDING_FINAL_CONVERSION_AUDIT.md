# Landing Final Conversion Overhaul — Phase 1 Read-Only Audit

**Status of this document:** Phase 1 read-only audit. No code has been edited to produce this report. Findings are evidence-based with file:line citations gathered by direct reads plus two parallel research passes, plus a baseline `typecheck`/`lint`/`build`/`test` run.

**Tag legend:** `SOURCE_CONFIRMED` · `RUNTIME_CONFIRMED` · `NOT_CONFIRMED` · `OUT_OF_SCOPE`.

**Baseline:**
- `npm run typecheck` → **PASS**, `SOURCE_CONFIRMED`
- `npm run build` → **PASS**, `SOURCE_CONFIRMED`
- `npm run lint` → **FAIL** — 13,917 problems (12,697 errors / 1,220 warnings), same magnitude and same unrelated files (`tailwind.config.ts`, edge-function `any` usage) as every baseline this project has ever run. Pre-existing drift, not in scope.
- `npm run test` → **127/127 pass** — an improvement since the last baseline this project recorded (previously 121/127 with 6 pre-existing `stripeWebhookSignature.test.ts` failures from a `crypto.subtle`-in-Vitest gap; that gap appears resolved in this environment now). `SOURCE_CONFIRMED`, not something this audit changed.

---

## A. Current section map

Guest landing route: `/` → `DefaultRoute` (`App.tsx:307`) → `UnifiedHome` → (`!user`) → `KretopiaLanding` (`UnifiedHome.tsx:486-489`). `src/pages/Landing.tsx` is **not** the real implementation — it's a bare redirect stub (`<Navigate to="/" replace />`, `Landing.tsx:3`). `SOURCE_CONFIRMED`.

`KretopiaLanding.tsx` renders the Hero on the critical path, then lazy-loads `LandingBelowFold.tsx`, which renders, in order:

1. **`KretopiaHero`** — search-first hero (Section B/C detail below).
2. **`SearchTutorialSection`** (`id="chapter-search"`) — the "1 Search / 2 Review / 3 Claim" summary + "Search Your Name" button + `FeatureTutorialPanel`. **This is the brief's target for removal (§4/§7).**
3. **`InlineSignupBar`** (`id="inline-signup"`) — a real, already-live "Claim your Passport" CTA bar, routing to the exact URL the brief requires preserved (`/auth?tab=signup&intent=inline_bar`).
4. **`ChapterSection` × 4** (Passport, Scout, Match, Studio) — each: image, title, body, concept grid, CTA, `FeatureTutorialPanel` (always-visible, auto-playing tutorial — see §G).
5. **`VerifiedCreditsChapterSection`** — bespoke layout, embeds `TutorialStepper` directly (bypasses `FeatureTutorialPanel`).
6. **`ProductLoopSection`** (`id="chapter-loop"`) — the closed-loop diagram (Passport→Scout→Match→Studio→Completed Work→Stronger Passport). **Strong existing candidate for the brief's §7 "Kretopia loop visual," but positioned here, not near the top.** See §F/§P.
7. **`MeetKretoSection`** — bespoke layout, embeds `TutorialStepper` directly.
8. **`ChapterSection` (Community)** — same pattern as #4.
9. **`ForOrganisationsSection`** — B2B pitch, own CTA.
10. **`ClosingCTASection`** (`id="closing-cta"`) — final CTA, live user-count stat.
11. **`FAQSection`** — revived in a prior pass, no CTA.
12. **`EditorialFooter`**.

Plus, outside `LandingBelowFold`: **`StickyMobileCTA`** (guest-only, `lg:hidden`, appears after `scrollY > 500`) and **`ChapterProgressNav`** (desktop-only scroll-spy side rail, unrelated to tutorials — see §G).

`SOURCE_CONFIRMED` throughout.

## B. Current CTA inventory

Full list of every `/auth`-bound CTA reachable from the live guest render tree:

| Location | Destination | Label |
|---|---|---|
| `KretopiaHero.tsx:259` | `/auth?tab=signup&intent=hero` | "Claim your Passport" (typographic link) |
| `KretopiaHero.tsx:267` | `/auth?tab=signin` | "Sign in" |
| `InlineSignupBar.tsx:48` | `/auth?tab=signup&intent=inline_bar` | "Claim your Passport" (button) |
| `ChapterSection` → Passport, `LandingBelowFold.tsx:69` | `/auth?next=/profile&tab=signup&src=chapter-passport` | "Build Your Passport" |
| `ChapterSection` → Scout, `:107` | `/auth?next=/scout&tab=signup&src=chapter-scout` | "Explore Opportunities" |
| `ChapterSection` → Match, `:131` | `/auth?next=/match&tab=signup&src=chapter-match` | "Find Collaborators" |
| `ChapterSection` → Studio, `:154` | `/auth?next=/desk&tab=signup&src=chapter-studio` | "Create a Project" |
| `ChapterSection` → Community, `:183` | `/auth?next=/circle?tab=live&tab=signup&src=chapter-community` (malformed nesting, see below) | "Join a SoundStage" |
| `MeetKretoSection.tsx:158` | `/auth?next=/circle&tab=signup&src=meet_kreto` | "Meet Kreto" |
| `MeetKretoSection.tsx:248` | `/auth?next=%2Fcircle` | 4x dynamic "Try asking" prompts |
| `ForOrganisationsSection.tsx:99` | `/auth?tab=signup&src=for_organisations` | "Partner With Us" |
| `ClosingCTASection.tsx:117` | `/auth?tab=signup&intent=closing_cta&src=closing_cta` | "Claim Your Creative Passport" |
| `ClosingCTASection.tsx:131` | `/auth?src=closing_cta` | "Already have an account? Sign in" |
| `StickyMobileCTA.tsx:37` (imperative `navigate`) | `/auth?tab=signup&src=sticky_mobile` | "Get Started — Free" |

That's **~13 distinct CTA instances** across the page — none stacked in the same viewport, each with a distinct `src`/label, consistent with a prior pass's finding that CTA repetition here is deliberate and evidence-based (the `InlineSignupBar` itself exists because "82% of landing visitors were never reaching /auth at all").

**Confirmed dead weight, not part of this audit's live scope but worth naming so it isn't confused for something to touch:** ~20 files under `src/components/landing/*.tsx` (outside the `kretopia/` subfolder) — `AccountingSuiteSection`, `BeforeAfterSection`, `ThriveDeskShowcase`, `ICDBSection`, `AIMatchingShowcase`, `PortfolioShowcase`, `PostOpportunitySection`, `CreatorDashboardSection`, `WhyCreatorsChooseSection`, `ProductSectionThrive`, `LiveGigsStrip`, `ThriveFundShowcase`, `VisualProofCard`, `ComparisonTableSection`, `DiscoverCreativesRow`, `PricingPreviewSection`, `HeroPhoneCarousel`, `ClaimYourCreditsSection`, `ProductReelSection`, `CoreValueBlocks`, `ThriveFundTeaserCard`, `SocialProofSection`, `BottomCTASection` — remnants of the pre-"Kretopia v1" old landing page, each with its own `/auth` CTA, none reachable (either not imported anywhere, or imported into `UnifiedHome.tsx` but never rendered in its JSX). `OUT_OF_SCOPE` for this task — flagged for a separate cleanup pass, same pattern as prior sessions' `TrustSection`/`CreativeUniverseSection`/`OneWedgeLanding` findings. `SOURCE_CONFIRMED`.

**Two real, small bugs found in the existing CTA system**, both safe to fix alongside the CTA hierarchy work (§8):
1. `LandingBelowFold.tsx:183`'s Community CTA nests an un-encoded `?tab=live` inside `next=`, producing `/auth?next=/circle?tab=live&tab=signup&...`. `URLSearchParams` tolerates it today (works by accident), but it's inconsistent with `MeetKretoSection.tsx:248`'s correct `encodeURIComponent` usage. `SOURCE_CONFIRMED`.
2. `src/components/ui/cta-button.tsx:9`'s doc comment cites the dead `BottomCTASection.tsx` as "the Landing Page CTA" — stale and misleading now. `SOURCE_CONFIRMED`.

## C. Current visual hierarchy

Hero (`KretopiaHero.tsx`) is **search-first, not CTA-first**: the dominant interactive element is the real global search bar (`UnifiedSearchDropdown`, `variant="hero"`); its own submit arrow is the primary action. Below it: 4 example-search chips, then a **typographic** (not button-styled) "Claim your Passport" link plus "Sign in," both small and low-contrast by design (`text-white/85`/`text-white/40`, underlined). `SOURCE_CONFIRMED`.

**This is the single biggest structural gap against the brief's Hero requirements (§3):** the brief wants one dominant heading, one true primary CTA **button**, and a specific new headline/value-prop/CTA/trust-line copy block — none of which matches the current search-first hero's actual content or CTA styling. This is a full hero replacement, not a copy edit. `SOURCE_CONFIRMED`.

## D. Current "Search Your Name" dependency map

`SearchTutorialSection.tsx` (117 lines, read in full):
- Lines 20-24: the `STEPS` array (Search/Review/Claim) — exactly the content the brief names for removal.
- Lines 75-91: renders that array as a 3-card row.
- Lines 101-107: the "Search Your Name" button (`scrollToHeroSearch`, scrolls back to hero and focuses its input — no real search happens here).
- Line 110: `<FeatureTutorialPanel steps={SEARCH_TUTORIAL} label="Search tutorial" visual={SearchVisual} />` — the deeper tutorial layer, separate from the 3-card summary.

**What must be preserved per the brief's own instruction** ("do not remove the underlying public Search feature... Search route... analytics... SEO/public discovery functionality"): the actual search feature lives entirely in `KretopiaHero.tsx`'s `UnifiedSearchDropdown` — `SearchTutorialSection` never reimplements search, it only explains and links back to the hero's real search bar. Removing this section's visible content has **zero effect** on the real search feature, its route, or its backend. `SOURCE_CONFIRMED`.

`SEARCH_TUTORIAL` (tutorial step content) and `SearchVisual` (the illustrative Framer-Motion mockup) are defined in `tutorialContent.ts`/`featureVisuals.tsx` respectively and are shared infrastructure also used elsewhere in the same pattern — deleting the whole file isn't necessary or advisable; only the visible Search/Review/Claim summary + button need to go, per §7's plan to replace this section's content with the Kretopia loop visual.

## E. Current "Claim Passport" dependency map

`InlineSignupBar.tsx` (59 lines, read in full) **already does most of what brief §4 asks for**, structurally:
- Real headline ("Your work already exists. Claim the record."), real CTA, real trust line ("Free forever · No credit card · 2-minute setup").
- CTA destination: `/auth?tab=signup&intent=inline_bar` — **the exact URL the brief requires preserved, byte for byte.** `SOURCE_CONFIRMED`.

**The one real defect**: the button is styled with `style={{ backgroundColor: ACCENT }}` (`InlineSignupBar.tsx:45`) — a **flat solid pink fill**, not the canonical glass/gradient system (see §N). This is precisely the "flat hot-pink button" anti-pattern the brief explicitly prohibits, on the exact section the brief wants strengthened. `SOURCE_CONFIRMED`.

## F. Current "Speed Session" dependency map

**No functional "Speed Session" button exists on the landing page.** The only references are illustrative, non-interactive text/mockup labels inside `featureVisuals.tsx`'s `SoundStagesVisual` (used by the Community chapter's tutorial visual): a static `<span>Speed Session</span>` pill (`featureVisuals.tsx:411`) and a "Speed Session — live now" mockup label (`:424`), both explicitly tagged `"Illustrative — not live data"` (per that file's own `VisualCardShell` pattern). Neither links to or imports the real `SpeedSession` feature (`src/pages/SpeedSession.tsx`). The Community chapter's real CTA goes to `/auth?next=/circle?tab=live`, unrelated to these mockup labels. `SOURCE_CONFIRMED`. Nothing to fix here beyond what §7/§8's general cleanup already covers.

## G. Current tutorial architecture

Three distinct, live components exist (not duplicated, not conflicting):

- **`FeatureTutorial.tsx`** — a self-contained, one-step-at-a-time card with Prev/Next and a proper `role="tablist"`/`role="tab"`/`aria-selected` dot-pill row, plus full `ArrowLeft`/`ArrowRight`/`Home`/`End` keyboard support. Used in-app (`Messages.tsx:322`), **not on the landing page**.
- **`FeatureTutorialPanel.tsx`** (48 lines, read in full) — pairs a visual with `TutorialStepper`. Used by `ChapterSection` (Passport/Scout/Match/Studio/Community), `SearchTutorialSection`, `EditorialTutorialSection`.
- **`TutorialStepper.tsx`** (216 lines) — the actual step-list UI. Used inside `FeatureTutorialPanel`, and directly (bypassing the panel) by `VerifiedCreditsChapterSection`/`MeetKretoSection`.

**Confirmed, already-good**: `TutorialStepper` already reserves a fixed `minListHeight = steps.length * 88 + 120` (`TutorialStepper.tsx:93,99`) specifically so switching steps doesn't resize the container or push page content — the brief's "screen must remain fixed" requirement is **already substantially implemented**, not something to build from scratch. No auto-scroll of any kind exists anywhere in this file. Content swaps in place via `AnimatePresence` (no `mode` set, defaults to `"sync"` — practically irrelevant here since only one child is ever active). `SOURCE_CONFIRMED`.

**Two real gaps vs. the brief's requirements:**
1. **Pattern mismatch**: `TutorialStepper` is an **accordion** (buttons with `aria-expanded`/`aria-controls`, all steps listed, one expands) — not a tab pattern, and not the brief's described "top-down card stack that resets to its first item on every step switch." The brief's described interaction (select a step → cards reveal top-to-bottom inside a fixed panel, resetting per switch) is a genuinely different UI than "click a row in an already-visible list to expand it." This is closer to `FeatureTutorial.tsx`'s one-panel-at-a-time model than to `TutorialStepper`'s. `SOURCE_CONFIRMED` as a real design gap, not a nitpick.
2. **Accessibility inconsistency**: `TutorialStepper` has no `aria-selected`, no `role="tablist"/"tab"`, and only `ArrowUp`/`ArrowDown` keyboard support (no `Home`/`End`) — `FeatureTutorial.tsx` (the in-app, non-landing component) already does all of this correctly. `SOURCE_CONFIRMED`.

**Always-visible, auto-playing today (confirmed via `FeatureTutorialPanel.tsx:23-25,31`):** every chapter's tutorial is **not** discreet or opt-in — it renders inline unconditionally and **auto-advances on its own** once scrolled into view (`autoPlay={inView}`). The brief's §5/§6 describe a "discreet interactive tutorial" behind a "fingerprint trigger" — implying collapsed-by-default, opt-in. Implementing that literally would mean reworking `ChapterSection`'s tutorial rendering (and `VerifiedCreditsChapterSection`/`MeetKretoSection`'s direct embeds) across **all 7 chapter instances**, not just Hero/Search/Claim. This is a substantially larger scope than §3/§4 alone — flagged as a sequencing decision in §P. `SOURCE_CONFIRMED`.

**The fingerprint trigger does not exist anywhere as a tutorial-opening control.** Full `src/`-wide search for `Fingerprint`/lucide's `Fingerprint` icon: every landing-page usage is either purely decorative (`aria-hidden`, inside static content — `SearchTutorialSection.tsx`, `VerifiedCreditsChapterSection.tsx`) or (`ProductLoopSection.tsx:72-85`) a real accessible button, but wired to a stage-highlight in the loop diagram, not a tutorial launcher. Building the fingerprint-icon tutorial trigger described in §6 is **new UI**, not a refactor of something existing. `SOURCE_CONFIRMED`.

Also found: `ChapterProgressNav.tsx` is a fully separate system — an `IntersectionObserver`-driven scroll-spy side rail for jumping between whole page chapters (reads `CHAPTER_REGISTRY`), unrelated to per-chapter tutorial steps. No shared state with `TutorialStepper`. `SOURCE_CONFIRMED`.

## H. Current image/logo asset inventory

- Real chapter photos: `src/assets/kretopia/chapter-{passport,scout,match,studio,soundstages}.jpg` — used by the 5 `ChapterSection`/Community instances via `image={...}` props. `SOURCE_CONFIRMED`.
- Verified Credits, Kreto, Search, and the Loop diagram all use **illustrative Framer-Motion mockups**, not static images (`featureVisuals.tsx`, `PassportVisual`/`ScoutVisual`/`MatchVisual`/`StudioVisual`/`SoundStagesVisual`/`SearchVisual`) — plain HTML/CSS + Framer Motion, no canvas, no external image dependency. Every card is explicitly tagged `"Illustrative — not live data"`. Lazy at the route-chunk level (bundled into the same lazy `LandingBelowFold` chunk), not lazy per-component. `SOURCE_CONFIRMED`.
- Official brand marks: `src/assets/brand/kretopia-k-mark.png` / `kretopia-wordmark.png`, rendered via `src/components/BrandLogo.tsx` (header/footer, not landing-body). `SOURCE_CONFIRMED`.
- `BrandDots` (`src/components/brand/BrandDots.tsx`) exists as a loading-state component, separate from `KretoMark.tsx` (the Kreto agent's own mark). Not currently used inside any landing tutorial. `SOURCE_CONFIRMED`.

## I. Auth routing and signup conversion path

- `Auth.tsx` reads `?tab=` (drives real UI — signin vs signup form) and `?next=`/`?redirect=`/a `sessionStorage` stash (drives real post-auth navigation, correctly prioritized: `claim` → `event` → `next` → `redirect` → stash → `/`). Both `SOURCE_CONFIRMED`, both working correctly.
- **`?intent=` is read nowhere.** Grepped `Auth.tsx`, `landingMetrics.ts`, `landingFunnel.ts`, `analytics.ts` for the literal string `intent` — zero matches outside the landing files that *set* it. Every CTA setting `?intent=inline_bar`/`hero`/`closing_cta` is carrying a dead parameter today — it survives only as an inert query-string artifact. **This directly affects the brief's own Hero CTA guidance**, which conditionally suggests `?intent=hero_passport` "only if the Auth route safely accepts this intent and preserves it" — **confirmed: it does not.** `SOURCE_CONFIRMED`. Recommendation in §P: use the real, live-read `?src=` param instead (feeds `resolveAuthEntrySource` in `landingMetrics.ts:125-129` for actual analytics attribution), not another dead `intent=`.
- `next` preservation is a genuinely fixed prior bug (comment at `eventAuthRedirect.ts:19-22` documents that `?next=` used to be silently dropped) — now correctly wired and must not regress.

## J. Existing analytics/experiment status

- `trackLandingCta`/`trackLandingCtaClick` (`landingFunnel.ts`/`landingMetrics.ts`) are real, live, and used consistently on every reachable CTA except `StickyMobileCTA.tsx` (uses a raw imperative `navigate()` with no tracking call — a gap worth closing while touching CTA hierarchy). `SOURCE_CONFIRMED`.
- `resolveAuthEntrySource` (`landingMetrics.ts:125-129`) reads `?src=` against a fixed enum, defaulting to `"unknown"` for anything not registered — any new `src` value used by a redesigned Hero CTA must be added to that enum or it'll attribute as unknown. `SOURCE_CONFIRMED`.
- `useLandingVariant` — **already deleted** in a prior pass this project (confirmed retired A/B stub, hardcoded to one arm, removed along with the orphaned `OneWedgeLanding.tsx`). Nothing to audit here; the brief's mention of it is now moot. `SOURCE_CONFIRMED`.
- No second/conflicting analytics system exists on Landing today. `SOURCE_CONFIRMED`.

## K. Accessibility risks

- **Confirmed real gap**: `TutorialStepper`'s accordion pattern lacks `aria-selected`/`role="tablist"` and `Home`/`End` keyboard support (§G).
- **Confirmed clean**: exactly one `<h1>` exists on the whole landing render tree (`KretopiaHero.tsx:124`) — no duplicate-H1 risk today, must stay true after the hero replacement.
- **Confirmed clean**: every Framer-Motion-animated component on the *live, reachable* render path already checks `useReducedMotion` before animating. The only violations found (`ThriveFundShowcase`, `VisualProofCard`, `ProductReelSection`, `CreatorDashboardSection`, `DiscoverCreativesRow`) are confined to the dead/orphaned files named in §B — not live bugs, but worth deleting rather than leaving as latent violations if anyone ever re-wires them in.
- **Plausible, unconfirmed**: `StickyMobileCTA` (`z-40`, fixed bottom) could theoretically be visually covered by a `Toast` (`z-[100]`) or `Drawer` (`z-50`) if either fires while a guest has scrolled past 500px — inferred from z-index values, not reproduced live. Worth a quick browser check, not a proven bug.
- `ProductLoopSection`'s desktop stage buttons have no explicit `aria-label` (label text sits visibly beside the icon inside the same button, so the accessible name is still correct via the button's text content — not a violation, just noted for completeness).

## L. Performance risks

- No LCP-blocking assets found in the hero — background is a CSS gradient, not an image; the two ambient blur animations are `motion.div` with `transform`/opacity, gated behind `!reducedMotion`.
- All below-fold visuals are already deferred at the route-chunk level (`LandingBelowFold` itself is `lazy()`-loaded from `KretopiaLanding.tsx`).
- `TutorialStepper`'s fixed-height reservation (§G) already prevents the exact kind of CLS a naive tutorial redesign could reintroduce — worth preserving that mechanism (or an equivalent) in any rework rather than discarding it.
- Not measured in this pass: actual LCP/CLS/INP numbers (`NOT_CONFIRMED` — this environment has no real-user-monitoring or Lighthouse run performed as part of this audit; recommend running one after implementation, not before, since the current page is about to change substantially).

## M. SEO risks

- `/` sets title/description/canonical via `<SEO>` in `UnifiedHome.tsx:477-481` (`react-helmet-async`-based, confirmed real, not a stub). Canonical resolves to `https://www.kretopia.com/`. `SOURCE_CONFIRMED`.
- Exactly one H1, semantic `<h2>`s for every chapter section — confirmed no heading-hierarchy violation today.
- No crawler-hidden text found in the current tutorial/visual components (illustrative visuals render real DOM text, not canvas-only or image-only content).

## N. Files to modify (if approved)

**Hero replacement (§3):**
- `src/components/landing/KretopiaHero.tsx` — full content replacement per the brief's exact copy block; CTA becomes a real button (not typographic link), using the canonical `.btn-glass-primary`/`.btn-glass-hero` gradient system (§O) instead of inventing new styles.

**Claim Passport section (§4):**
- `src/components/landing/kretopia/SearchTutorialSection.tsx` — remove the Search/Review/Claim summary + "Search Your Name" button.
- `src/components/landing/kretopia/InlineSignupBar.tsx` — restyle CTA button from flat `backgroundColor: ACCENT` to the canonical gradient system; copy may be strengthened per brief's guidance while preserving the exact CTA URL.

**Tutorial system (§5/§6)** — scope decision needed, see §P:
- `src/components/landing/kretopia/TutorialStepper.tsx` and/or `FeatureTutorialPanel.tsx` — likely rework or a new sibling component, plus a new fingerprint-trigger control.

**Kretopia loop visual (§7)** — scope decision needed, see §P:
- `src/components/landing/kretopia/ProductLoopSection.tsx` (relocate/adapt) or a new component near `SearchTutorialSection`'s current position.

**CTA hierarchy (§8) / branding (§9):**
- `InlineSignupBar.tsx`, `ClosingCTASection.tsx` (verify already-canonical), `StickyMobileCTA.tsx` (add tracking call), `LandingBelowFold.tsx` (fix the malformed Community CTA query nesting), `src/components/ui/cta-button.tsx` (fix stale doc comment referencing dead `BottomCTASection`).

**Day/Night (§10)** — see §P for the scope question before any file changes here.

## O. Files to protect

- `src/lib/eventAuthRedirect.ts` — `next`/`redirect` precedence logic; already correct, do not touch.
- `src/pages/Auth.tsx`'s `tab` handling — already correct.
- The ~20 dead legacy landing files named in §B — do not delete as a side effect of this task; separate cleanup.
- `src/components/search/UnifiedSearchDropdown.tsx` and the real search route/backend — the brief is explicit that removing the *visible* Search/Review/Claim summary must not touch the real search feature at all, and it doesn't need to (§D).
- `ChapterSection.tsx`'s 4 non-Search chapter instances (Passport/Scout/Match/Studio) and their images/copy — out of scope unless the tutorial-trigger rework (§P decision) is explicitly extended to them.
- Any RLS/auth/payment logic — untouched by this entire task by the brief's own instruction.

## P. Implementation plan — including open decisions

Recommend four sequential, separately-approvable phases rather than one combined change, given the scope difference between them:

**Phase 1 — Hero + Claim Passport + CTA hierarchy (brief §3, §4, §8, §9).** Directly scoped, evidence-backed, no open design questions. Includes: hero copy/CTA replacement, `InlineSignupBar` restyle, the two small CTA bug fixes (§B), `StickyMobileCTA` tracking gap, stale comment fix.

**Phase 2 — Tutorial system rework (brief §6).** Requires a genuine design decision, not just implementation: `TutorialStepper`'s existing accordion pattern (fixed-height, no auto-scroll, already solid) vs. the brief's described top-down-reveal-per-step pattern are materially different interactions. Recommend building the described pattern as a **new** shared primitive (reusing `TutorialStepper`'s proven fixed-height/no-scroll techniques rather than its accordion markup), then deciding in Phase 3 how far to roll it out.

**Phase 3 — Roll the new tutorial pattern + fingerprint trigger out to chapters (brief §5).** `REQUIRES_PRODUCT_DECISION`: the brief's own §5 says "prioritize the core loop" (Passport → Credits/co-signs → Scout → Studio) and explicitly "do not force every product feature" — but today, *every* chapter (including Match, Community, Kreto) already has an always-visible auto-playing tutorial. Converting only some chapters to the new discreet/fingerprint pattern while leaving others auto-playing would read as inconsistent. Recommend deciding explicitly: convert all chapters uniformly, or explicitly name which stay as-is.

**Phase 4 — Kretopia loop visual replacing Search's old position (brief §7).** `REQUIRES_PRODUCT_DECISION`: `ProductLoopSection` already does almost exactly what §7 asks for, but it sits much further down the page (after Verified Credits) than where §7 wants the replacement (immediately after the Hero, where `SearchTutorialSection` sits today). Three options, not decided here: (a) move `ProductLoopSection` up to that position, (b) build a new, distinct visual near the top and leave `ProductLoopSection` where it is (risk: two very similar loop-diagrams on one page), or (c) keep `ProductLoopSection`'s position and put a lighter version of the same idea in the vacated slot. Recommend (a) unless there's a reason the later position matters (e.g., needing Verified Credits' concepts established first) — but this is a judgment call, not something to decide unilaterally.

**Also flagged, not gating Phase 1:** `?intent=` params are confirmed dead (§I) — recommend the new Hero CTA use `?src=hero_passport` (a real, tracked param) instead of inventing another inert `?intent=`, and *not* attempting to "fix" the existing dead `intent` values on other CTAs (out of scope, works fine as inert extra query string, changing it risks an unrelated regression for no user-facing benefit). Also flagged: the Day/Night requirement (§10) may need scope clarification — the entire landing hero/chapter spine currently hardcodes `#05070D`/`#FF2DA1` directly and never reads the app's theme tokens at all (confirmed structural fact, not a a nitpick — every section wrapper does `style={{backgroundColor: "#05070D"}}`), consistent with this page's established "always-dark cinematic editorial" identity confirmed deliberate in prior audits this project. Recommend treating "Day/Night QA" as verifying no contrast/bleed issues at the boundary between this fixed-dark page and the rest of the theme-aware app — not as a request to make Landing newly theme-reactive, which would be a much larger, different piece of work than anything else in this brief. Flagging rather than deciding.

## Q. Test plan (for Phase 2 of this task, once approved)

- Hero: exact copy match, single H1, CTA visibility above fold at 390/768/1440px, CTA route, keyboard focus, reduced-motion fallback, no duplicate tracking event.
- Claim Passport section: old Search/Review/Claim content absent, exact CTA URL preserved, canonical button style, no flat pink.
- Tutorial system (once Phase 2/3 design is settled): fixed outer height across step switches, no scroll jump, ARIA tab semantics with Home/End, fingerprint trigger has a real accessible name.
- CTA hierarchy: no two equal-weight CTAs in one viewport, all tracked, `StickyMobileCTA` gains tracking, Community CTA query-string bug fixed.

## R. Browser verification plan (for later phases)

Same structural limitation as every prior phase this project: no seeded test data blocks this specific audit (Landing is fully public/guest-facing), but a full 390×844/768×1024/1440×900 × Day/Night matrix has not yet been run — that's Phase 2+ work once implementation exists to verify.

---

**Phase 1 complete. No code has been edited.**

LANDING_AUDIT_COMPLETE
