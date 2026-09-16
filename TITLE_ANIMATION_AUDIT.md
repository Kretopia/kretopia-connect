# Title Animation System Audit

Section 6 of the August 31 release charter. Scope: inspect the landing page's title-reveal animation exactly as implemented, confirm whether every feature-page title uses "the same shared component," and produce this report. No code was changed for this audit — findings are handed to Section 8 (major page overhaul), which already touches every page named below.

Compiled: 2026-08-18. Repo: `/Users/noeplantier/thrivein-new-beta`, branch `feature/activation-priority-plan`.

---

## 1. The landing hero's signature animation

`src/components/landing/KretopiaHero.tsx:114-149` — the only title on the app that actually does what the charter calls "character-splitting." It is **word-splitting**, not character-splitting: the headline is authored as an array of lines, each broken into words (`HEADLINE`, lines 26-29), and each word is wrapped in its own `motion.span`.

Exact mechanics:
- Parent `motion.span` (line 117): `initial="hidden" animate="show"`, variant `{ show: { transition: { staggerChildren: reducedMotion ? 0 : 0.075 } } }` — each child word starts 75ms after the previous one.
- Each word (line 126-136): `hidden: { opacity: 0, y: 22, filter: "blur(10px)" }` → `show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.2, 0.65, 0.3, 0.95] } }`.
- Reduced motion (line 130-131): variants collapse to `{ hidden: {}, show: {} }` — no opacity/y/blur properties exist on either state, so the word renders at its natural style immediately with no visible transition.
- The accent word ("what's next") gets an additional static italic pink-glow treatment (line 139) independent of the reveal motion.
- This is a one-time, mount-triggered reveal (`animate="show"`, not `whileInView`) — it always plays once per page load, never re-triggers on scroll.

No other component in the codebase reproduces this pattern. A repo-wide search for word/character-splitting animation techniques (`staggerChildren`, `.split(...)`, `charAt`, per-letter `.map()`) turned up exactly one hit outside test/unrelated files: `KretopiaHero.tsx` itself. This confirms the blur-stagger reveal is a landing-page-only flourish, not a shared system — which is the charter's core question.

## 2. The two components feature pages actually use

Two separate components implement a **second**, simpler reveal pattern — single-block fade-up, no word split, no blur — and both are in active use across the app as "the shared feature-page header":

### 2a. `FeaturePageHeader.tsx` (`src/components/features/FeaturePageHeader.tsx`)
- Wrapper: `<div>`, `container mx-auto max-w-5xl px-4 pt-10 pb-8 sm:pt-14 sm:pb-12` (line 51).
- Motion (line 63-66): `initial={reducedMotion ? false : { opacity: 0, y: 18 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.85, ease: [0.2, 0.65, 0.3, 0.95] }}`.
- Reduced motion: `initial={false}` — Framer Motion skips the mount animation entirely and renders straight at the `animate` state.
- Extras: optional tutorial-trigger button (top-right corner, absolute), optional `tabs` slot below the title block.
- **14 consumers**: `FoundingMember.tsx`, `Subscription.tsx`, `Meetup.tsx`, `WorkHome.tsx` (Studio), `Circle.tsx`, `Recordings.tsx`, `Match.tsx`, `CreativeCircle.tsx`, `ThrivePay.tsx` (Krepay), `Profile.tsx` (Passport), `Scout.tsx`, `Clients.tsx`, `Admin.tsx`, `UnifiedHome.tsx` (Today).

### 2b. `EditorialPageHero.tsx` (`src/components/kretopia/EditorialPageHero.tsx`)
- Wrapper: `<section>`, `mx-auto max-w-[1100px] px-5 sm:px-8 py-10 sm:py-16` (line 68).
- Motion (line 65-67): `initial={reducedMotion ? false : { opacity: 0, y: 18 }}` → `animate={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.85, ease: [0.2, 0.65, 0.3, 0.95] }}` — **identical parameters** to FeaturePageHeader.
- Reduced motion: same `initial={false}` mechanism.
- Extras: `align` prop (left/center), `oneLine` prop (auto-scaled single-line title), generic `children` slot instead of a fixed tabs/tutorial contract.
- **5 consumers**: `PostOpportunity.tsx`, `Opportunities.tsx`, `About.tsx`, `Spotlight.tsx`, `CreditDatabase.tsx` (Verified Credits).

**These two components are not literally "the same shared component."** They are two independent files with duplicated JSX (aurora gradient, grain texture, eyebrow pill, `landing-h1`/`landing-sub` markup all copy-pasted between them — already flagged from the design-system angle in [SCOUT_DESIGN_SYSTEM_REFERENCE.md](SCOUT_DESIGN_SYSTEM_REFERENCE.md) §"aurora/grain cinematic plate duplicated inline"). Confirmed live via computed styles at 375px viewport:

| | `max-width` | `padding-top` | `padding-bottom` |
|---|---|---|---|
| FeaturePageHeader (`/founding-member`) | `1024px` | `40px` | `32px` |
| EditorialPageHero (`/spotlight`) | `1100px` | `40px` | `40px` |

The title block sits in a visibly wider container with 8px more bottom padding on EditorialPageHero pages. At desktop widths the gap is the same proportionally (`max-w-5xl` = 1024px vs `max-w-[1100px]`, a 76px difference in how wide the centered title column is allowed to grow).

## 3. A third variant: `ClosingCTASection.tsx`

`src/components/landing/kretopia/ClosingCTASection.tsx:35-45` uses a third pattern for its `landing-h1` heading: `initial={reducedMotion ? false : { opacity: 0, y: 14 }}`, but triggered by `whileInView` with `viewport={{ once: true, margin: "-60px" }}` instead of `animate` — a scroll-triggered reveal, not a mount-triggered one, with `duration: 0.7` and no explicit `ease` (Framer's default). This is correct for its context (a landing-page section the user scrolls to, not a page header that's visible on load) and is not a target of Section 8, but is recorded here since it's a third distinct implementation of a "title reveal" sharing the same `landing-h1`/`landing-glow` CSS classes as the other two.

## 4. Comparison table

| | Trigger | Split unit | Stagger | Blur | Duration | Easing | Reduced motion |
|---|---|---|---|---|---|---|---|
| `KretopiaHero` (landing) | mount (`animate`) | per word | 75ms | 10px→0 | 0.7s | `[0.2,0.65,0.3,0.95]` | empty variants (instant) |
| `FeaturePageHeader` | mount (`animate`) | whole block | none | none | 0.85s | `[0.2,0.65,0.3,0.95]` | `initial={false}` (instant) |
| `EditorialPageHero` | mount (`animate`) | whole block | none | none | 0.85s | `[0.2,0.65,0.3,0.95]` | `initial={false}` (instant) |
| `ClosingCTASection` | scroll (`whileInView`, once) | whole block | none | none | 0.7s | default | `initial={false}` (instant) |

`useReducedMotion()` (`src/hooks/useReducedMotion.ts`) is the one genuinely shared, consistent piece across all four — a single hook, live-tracking `prefers-reduced-motion`, used identically everywhere. That part of the system is already correctly unified.

## 5. Section-8 target pages: current state

The five pages Section 8 is scoped to overhaul (Scout as reference) currently split 3/2 across the two components:

| Page | Component today |
|---|---|
| Spotlight | `EditorialPageHero` |
| Verified Credits (`CreditDatabase.tsx`) | `EditorialPageHero` |
| Founding Circle (`FoundingMember.tsx`) | `FeaturePageHeader` |
| Creative Circle (`CreativeCircle.tsx`) | `FeaturePageHeader` |
| Admin Panel (`Admin.tsx`) | `FeaturePageHeader` |

## 6. Findings (as of the original 2026-08-18 audit)

1. **No feature page reproduces the landing hero's actual signature animation.** The word-split blur-stagger reveal that makes the landing headline distinctive is landing-only. Every feature-page title instead gets a plainer single-block fade-up. This may be intentional (a one-time cinematic flourish for the landing page vs. a lighter, faster reveal for pages visited repeatedly, where re-running a 700ms-per-line stagger on every navigation could feel slow) — flagging it as a finding rather than a defect, since re-litigating "should feature pages also blur-stagger" is a product call, not something to silently decide as an audit.
2. ~~**Two components, not one, implement "the shared feature-page header."**~~ **RESOLVED — see §7 below.**
3. ~~**The five Section-8 target pages are split 3/2 across the two components...**~~ **RESOLVED — see §7 below.**
4. ~~**Recommendation, deferred to Section 8...**~~ **DONE — see §7 below.**

## 7. Update — 2026-08-21, consolidation confirmed complete

Re-checked `EditorialPageHero.tsx` directly rather than trusting this audit's 3-day-old findings (per "verify before recommending from memory"). **Finding 2 is stale — the consolidation this audit recommended already happened**, sometime between 2026-08-18 and now, as part of other work on this branch:

```tsx
// EditorialPageHero.tsx — confirmed 2026-08-21
import { CinematicHeaderPlate } from "@/components/features/CinematicHeaderPlate";
// ...
<CinematicHeaderPlate eyebrow={kicker} title={title} accentTitle={accentTitle}
  subtitle={subtitle} align={align} oneLine={oneLine}
  footer={children && <div>...</div>} />
```

`FeaturePageHeader.tsx` already wrapped `CinematicHeaderPlate` too (confirmed earlier this session, when it was extended with the `oneLine` prop). **Both components now render through the exact same underlying engine** — the "internal primitive" this audit's Finding 4 recommended extracting already exists as `src/components/features/CinematicHeaderPlate.tsx`, and both consumer components are thin wrappers supplying their own backdrop chrome (aurora/grid/grain) and distinct extras (tutorial trigger + tabs for `FeaturePageHeader`; `align`/`oneLine`/generic `children` for `EditorialPageHero`).

**This is the `KretopiaAnimatedTitle` component the Global Overhaul brief (§4) asks for — reused, not rebuilt.** It already covers every one of the 18 pages currently on the shared header system (13 via `FeaturePageHeader`, 5 via `EditorialPageHero`, see `GLOBAL_UX_UI_INVENTORY.md`), with one animation engine, one easing curve (`cubic-bezier(0.2, 0.65, 0.3, 0.95)`), one reduced-motion behavior (`initial={reducedMotion ? false : {...}}`), and the same `oneLine` single-line-title behavior fixed earlier this session.

**Finding 1 — update 2026-08-27: intentionally reopened.** The Landing Page Motion overhaul (see `LANDING_MOTION_SYSTEM_AUDIT.md`) explicitly asked for the hero's word-stagger-blur reveal to become the one shared heading system across every surface, having weighed this same "repeats every navigation" tradeoff with full knowledge of this finding. `CinematicHeaderPlate.tsx`'s `<h1>` now renders through the identical word-split, blur, stagger mechanic as `KretopiaHero.tsx` (same 0.075s stagger, same 0.7s duration, same easing), which by construction covers every consumer of `FeaturePageHeader`/`EditorialPageHero`. What changes the original cost/benefit call: feature-page titles are short by this component's own contract (2-4 words), so the added per-word stagger costs only a few hundred ms over the old single-block fade — not the hero's full-sentence reveal this finding was originally weighing. `useReducedMotion()` continues to fully disable it exactly as before, so the vestibular-sensitivity concern this finding raised remains addressed regardless of visit frequency.
