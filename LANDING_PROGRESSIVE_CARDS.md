# Landing Progressive Cards

Section 7 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## What was built

`FixedProgressiveCard` — [`src/components/landing/kretopia/FixedProgressiveCard.tsx`](src/components/landing/kretopia/FixedProgressiveCard.tsx) — a bounded scroll region whose content pins (`position: sticky`) in the viewport while native scroll deterministically drives a top-to-bottom reveal of six fixed slots: **eyebrow → title → subtitle → key value → supporting item → CTA**.

```tsx
<FixedProgressiveCard
  eyebrow={...}
  title={...}
  subtitle={...}
  keyValue={...}       // the single most important value/action
  supportingItem={...} // optional trailing reassurance
  cta={...}
  scrollSpan={1.6}      // default — 160vh of scroll drives the reveal
/>
```

## How it satisfies the brief's technical requirements

| Requirement | How it's met |
|---|---|
| Fixed/sticky bounded geometry | Outer wrapper has a fixed, finite height (`scrollSpan × 100vh`, default 160vh); inner content is `position: sticky; top: 4rem/5rem` so it pins while the bounded region scrolls past, then releases naturally like any sticky element. |
| Content reveals top-to-bottom | Six `useTransform` windows over `scrollYProgress`, each slightly overlapping the next (eyebrow `[0,.14]`, title `[.08,.3]`, subtitle `[.24,.44]`, key value `[.4,.6]`, supporting item `[.56,.74]`, CTA `[.7,.9]`) — a continuous cascade, not six separate pops. |
| Deterministic scroll-driven progress | Driven entirely by Framer Motion's `useScroll({ target, offset: ["start start", "end end"] })` — a pure function of scroll position, not a spring, not velocity-based, not a "play once" `whileInView` trigger. Verified live: scrolling forward reveals slot-by-slot; scrolling back to the same position un-reveals to the exact same state. |
| Static fallback | Under `useReducedMotion()` (the same hook used in 40+ components across the codebase), the component skips the scroll rig entirely — no bounded-height wrapper, no sticky, no motion values — and renders all six slots in normal flow, fully visible immediately. |
| No scroll-hijacking | Nothing calls `preventDefault()` on wheel/touch/scroll, nothing sets `scrollTop`/`scrollTo` — the browser's native scroll is the only input read. |
| No infinite scroll | The pinned region has a fixed, finite height (`scrollSpan` is a real number, not a growing/observed value) — it releases and the page continues normally afterward. |
| No scroll-snapping | No `scroll-snap-*` CSS anywhere in the component or its container. |

## Where it's applied — and where it deliberately isn't

Applied to exactly one place: **`ClosingCTASection`** ([`src/components/landing/kretopia/ClosingCTASection.tsx`](src/components/landing/kretopia/ClosingCTASection.tsx)), the landing page's final section — step 10, "Primary CTA," of the brief's 10-step storytelling structure. All existing copy, the search-handoff behavior (`scrollToHeroSearch`, unchanged), and the `analytics.ctaClick` call were preserved exactly; only the reveal mechanism changed, from a three-block `whileInView` fade to the six-slot scroll-driven cascade. The closing wordmark line ("Kretopia / Where Creativity Lives.") sits outside the card, statically, below it — it's a page signature, not a content slot the brief's spec covers.

**Not applied to the 8 chapter sections above it** (`ChapterSection`, `VerifiedCreditsChapterSection`, `TrustSection`, `ProductLoopSection`, `MeetKretoSection`, etc.). This was a deliberate scoping decision, not an oversight:

- Those sections already have a working, coherent `whileInView` reveal pattern (image + text fade/slide together as each chapter scrolls into view) that reads as one consistent cinematic voice across the whole page. Converting all 8 to pinned-and-scrubbed cards would be a wholesale rewrite of an already-good, already-shipped visual identity — high risk, uncertain value, and outside what "add a FixedProgressiveCard component" asks for.
- The brief's own six-slot content shape (eyebrow/title/subtitle/**one** key value/one supporting item/CTA) maps naturally onto a single-pitch moment, not an 8-chapter narrative with images, concept grids, and full interactive tutorial panels per section — forcing `ChapterSection`'s richer content into six fixed slots would mean either dropping content or fighting the component's own shape.
- The closing CTA is visited once, at the end, un-repeated — the safest possible place to introduce a genuinely new interaction pattern, since a visitor never scrolls past it twice in the same session the way they might scroll past an early chapter while orienting themselves.

If a second application is wanted, `VerifiedCreditsChapterSection` or `TrustSection` are the next-best candidates — both already present a single, focused pitch rather than a multi-part chapter.

## Verification

- **Live, scroll-position-driven reveal**: confirmed via direct DOM/computed-style reads at multiple real scroll offsets in the guest-mode browser preview. At ~9% into the pinned range, all six slots measured `opacity: 0`. At ~38% (`scrollY` 200px into the 531px scrollable range), eyebrow and title measured `opacity: 1`, subtitle was mid-fade, key value/supporting/CTA still `0` — screenshotted, showing exactly eyebrow+title+fading-subtitle visible and nothing below. At ~90%, all six slots were fully visible (`opacity: 1`), screenshotted showing the search field, "Free to claim.", and the CTA button all rendered.
- **Deterministic in both directions**: scrolled back to ~4% into the range and confirmed the screenshot returned to fully blank — the same state as the initial forward pass at that position, not a "stuck revealed" one-shot animation.
- **No console errors** introduced by the new component or the `ClosingCTASection` rewrite (checked via `read_console_messages`; the only errors present were pre-existing, unrelated backend/CORS noise on the authenticated dashboard, not the landing page).
- **`npm run typecheck`**: only the single pre-existing baseline error (`StudioAICreate.tsx`, unrelated), unchanged.
- **`npm run build`**: clean, same pre-existing chunk-size warning as baseline.
- **`npm run test`**: 68/68 passing, unchanged.
- **Reduced-motion fallback**: verified by code review against the established, working `useReducedMotion()` pattern (used successfully in 40+ other components this session) rather than live emulation — this session's browser tooling has no `prefers-reduced-motion` override, only light/dark `colorScheme`. Not independently browser-verified; flagged here rather than silently assumed.

## What this does not cover

- The reduced-motion fallback path was not live-verified in a browser (tooling limitation, see above).
- No second application of the component — only `ClosingCTASection` uses it.
- Only one mobile checkpoint taken (375×812, mid-cascade) — confirmed no horizontal overflow and a correctly-ordered partial reveal (subtitle/key value/supporting item mid-fade, title above already fully revealed and scrolled past), but not the full 7-breakpoint matrix or every point along the mobile scroll range.
