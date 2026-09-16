# Landing Hero — Verified Creative Signal Field: Read-Only Audit

## Status: `AUDITED` — no code has been edited. This document only.

## 0. Safety and scope check

```
git status        -> only supabase/functions/mcp/index.ts modified (pre-existing,
                      unrelated to Landing; left untouched all session per standing
                      instruction to keep it out of every commit)
git diff --staged -> empty
git log -15       -> confirms recent Landing hero history (see §0.1)
```

No stashes, resets, or destructive operations were used to reach this state.

### 0.1 Operational finding: two hero PRs merged, but the current tip is unmerged

`git log` shows PR #88 and a follow-up PR #89 both merged into `main`. However, comparing the local branch tip against `origin/main` (`git log origin/main..HEAD`) shows **five commits past what PR #89 merged** are still sitting on `feature/reliability-overhaul` with **no open PR**:

```
04d869aa feat(landing): GTM-reviewed hero copy, navbar CTA, calmer aurora
49ed1d50 feat(landing): realistic aurora palette + cursor spotlight
aefb4d1f feat(landing): interactive aurora curtains, shorter copy, calmer CTAs
ae359454 Merge remote-tracking branch 'origin/feature/reliability-overhaul'...
ff8d2c35 feat(landing): Northern Lights hero, two-tone title, dual CTAs
```

This means **everything from the Northern Lights aurora onward — including the current GTM-reviewed copy and navbar CTA change — is not yet visible anywhere main is deployed from.** This isn't this task's job to fix, but it's the reason any external preview may look stale, and it means the work this audit describes still needs a PR opened once implementation is done. Flagging as `REQUIRES_PRODUCT_DECISION` only in the sense that someone needs to open/merge it — no code decision is needed.

## 1. Current visual layers (as implemented today)

File: [`src/components/landing/KretopiaHero.tsx`](src/components/landing/KretopiaHero.tsx) (350 lines). Layer stack, back to front, inside `<section id="kretopia-hero">`:

1. Warm vignette — radial-gradient div, `rgba(120,70,40,...)` warm brown + a black corner darken. Static, `aria-hidden`.
2. **Aurora container** (`mixBlendMode: screen`) containing:
   - 4× `AuroraCurtain` — tall blurred divs (`blur-[70-75px]`), each with its own multi-stop `linear-gradient`, animating `scaleY`/`skewX` on an infinite loop (22-31s) AND drifting `x`/`y` via a pointer-tracked, spring-smoothed `useTransform`.
   - 1× cursor "spotlight" — a `blur-[85px]` radial gradient that tracks the pointer directly (tighter spring than the curtains).
3. Faint coordinate grid — 64px grid lines at 16% opacity, radially masked to fade at the edges. Static. **This already matches the brief's "GRID" requirement almost exactly as specified** (very faint, low opacity, static, no parallax) — no change needed here.
4. Content column (eyebrow, H1, supporting line, body copy, CTA pair, microcopy).
5. Bottom dissolve gradient into the next section.

## 2. Current dominant colors — the actual problem, precisely

| Element | Color used | Brand-token status |
|---|---|---|
| Curtain 1 | `rgba(52,211,153,...)` (Tailwind emerald-400) | **Raw hex-equivalent, not a token. Emerald/green is explicitly reserved for KrePay per house rules — this is a real brand-consistency violation, not just "too colorful."** |
| Curtain 1–2 transition | `rgba(45,212,191,...)` (teal-400) | Raw, not a token. Used as a *dominant* color across 3 of 4 curtains — the brief allows teal only as a "tiny optional accent," not a structural color. |
| Curtain 2–3 | `rgba(129,102,255,...)` (indigo/violet) | Raw. In the same family as the Signal Triad's violet (`#9413D2`) but not the same value and not a token. |
| Curtain 3 | `rgba(255,45,161,...)` (matches `--energy`) | Correct hue, but hardcoded rather than reading `hsl(var(--energy))`. |
| Spotlight | `rgba(148,255,214,...)` (mint/cyan) | Raw, off-brand — not in the Signal Triad or `--energy` at all. |

**Root cause of "too much color":** the hero currently mixes five distinct hues (green, teal, violet, pink, mint) as co-equal dominant colors via `mix-blend-mode: screen`, which is precisely what screen-blending many saturated hues produces — a washed, rainbow-adjacent look. This is a *design* problem (too many co-dominant hues), not merely an opacity problem — the brief is correct that simply dimming the existing layers would not fix it.

## 3. Existing brand color system (discovered, not previously honored by this hero)

- [`src/index.css:80-83`](src/index.css) — `--signal-pink`, `--signal-amber`, `--signal-violet`, `--signal-teal` are **all defined as the same value**, `327 100% 59%` (`#FF2DA1`), with comments: *"retired triad member — now = accent"* and *"kept as an alias name; hundreds of call sites reference it."* This is direct, load-bearing evidence that the design system was deliberately consolidated from a multi-hue "Signal Triad" down to **one dominant pink accent**. The current aurora directly contradicts this consolidation by reintroducing five hues.
- [`src/components/brand/BrandDots.tsx`](src/components/brand/BrandDots.tsx) — the historical three-dot mark (Violet `#9413D2`, Magenta `#E0179C`, Amber `#FEA61A`), explicitly documented as reserved for **loading/pending states only** ("Do NOT use it as a permanent decoration"). Not a fit for a static hero background element — noted for completeness, not for reuse here.
- [`src/components/brand/KretoMark.tsx`](src/components/brand/KretoMark.tsx) — the official K-mark component. Renders the real multicolor K-mark asset (same image `BrandLogo` uses in the navbar) at various sizes, with a `"bare"` variant that renders just the icon with no surrounding surface — exactly the form factor for a subtle, non-interactive brand signal inside a custom composition. This is almost certainly what the brief means by *"use the official Kretopia K-mark if it already exists."*
- `--k-midnight: 240 18% 5%` (`#0B0B10`) exists as a token, but it is **not** what Landing currently uses — every Landing section (this hero included) hardcodes `#05070D` instead, consistently, across ~15 components. This is a pre-existing, deliberate, page-wide convention, not a hero-specific oversight. Recommendation: **preserve `#05070D`** for the hero background rather than switching to `--k-midnight`, since changing only the hero would create a visible color seam at the boundary with every section below it — out of this task's "Hero only" scope to fix site-wide.
- `--secondary` (dark/midnight theme: `222 22% 13%`, `#1A1E28`) is the closest existing "graphite/structural grey" token, and is already the grey end of `.btn-landing-primary`'s gradient — the natural choice for the Signal Field's grey component, for consistency with the CTA it sits behind.
- `--energy: 327 100% 59%` (`#FF2DA1`) is constant across every theme/vibe variant in the codebase (light, dark, midnight, neon) — the one truly stable "focused brand signal" color to build the field around.

## 4. Current CTA hierarchy — already compliant, do not restructure

```tsx
Primary:   <Link to="/auth?tab=signup&src=hero_passport"> ... className="btn-landing-primary ...">
             Build My Passport →
Secondary: <Link to="/auth?next=/scout&src=hero_explore"> ... className="btn-glass btn-glass-outline ...">
             Explore Opportunities
```

- `.btn-landing-primary` ([`src/index.css:1321+`](src/index.css)) is the canonical grey-to-pink gradient button, built entirely from `--secondary`/`--energy`, already toned down in an earlier pass (soft single shadow, no multi-layer glow ring). **This already satisfies the brief's CTA color/style requirements as written — no CTA restyle is needed**, only preserving it while the background behind it changes.
- Both CTAs are real `<Link>` elements (React Router), semantically buttons-as-links, with visible focus (`:focus-visible` box-shadow ring, confirmed genuine via computed-style testing in an earlier pass this session), touch-friendly padding (`px-7 py-3.5`), no nested interactive content, no fake loading state, no auto-navigation.
- Routes and query params are exactly what the brief says to preserve — `tab=signup`, `next=/scout`, plus `src=` tracking params. **No route changes are planned or needed.**

## 5. Current copy — a real discrepancy with this brief's assumption

This brief's §4 states the "approved" copy to preserve-or-restore is the **older** version:
> "Turn the work you've already done into your next opportunity." / "Build a Creative Passport from your real work, get your Credits co-signed..." / "Build my Creative Passport"

The **actual current copy**, implemented in the immediately preceding session turn per an explicit, detailed GTM/conversion-strategy review, is:
> Eyebrow: "For creative professionals" · H1: "Find work that fits" / "what you do." · Supporting line: "Your past work should help create your next opportunity." · Body: "Your Creative Passport is a living record of your real projects, credits and skills. Get your work co-signed, then let Scout surface opportunities that fit what you've already proved." · CTAs: "Build My Passport" / "Explore Opportunities"

That GTM review ended with an explicit instruction: *"I would not keep rewriting the hero after this until we have actual conversion data from enough real users."*

**This is flagged as `REQUIRES_PRODUCT_DECISION`, not silently resolved either way.** My recommendation is to **keep the current GTM copy** and treat this brief's copy block as referring to an earlier snapshot it doesn't have visibility into, rather than reverting a deliberate, recently-locked decision — but this is a product call, not mine to make unilaterally. I will not touch copy without explicit confirmation of which version to ship.

## 6. Current animation behavior

- Entrance: word-by-word blur-reveal on the H1 (opacity/y/blur, framer-motion `variants`, `staggerChildren`), calm fade-ins on the paragraphs/CTA row. None of this is part of "the aurora" — it stays as-is regardless of the background redesign, and already fully respects `prefers-reduced-motion` (`useReducedMotion()` gates every `animate` prop).
- Background: 4 curtains loop `scaleY`/`skewX` indefinitely (22-31s cycles) AND respond to pointer position via spring-smoothed `x`/`y` (`useMotionValue`/`useSpring`/`useTransform`, framer-motion — already a project dependency, no new package needed). The spotlight tracks the pointer more tightly.
- Reduced motion: curtains freeze at rest position (no `animate` prop at all when `reducedMotion` is true), the spotlight element is not rendered at all (`{!reducedMotion && (...)}`), pointer handlers early-return. This pattern already satisfies the brief's REDUCED MOTION requirements and will carry over to the new field unchanged in spirit.

## 7. Performance — measured baseline (before any change)

Measured against the **production build** (`npm run build` + `vite preview`, not the dev server — the dev server's unbundled module graph gives misleading numbers), Lighthouse 13.4.1, desktop preset, headless Chrome, single run (local machine, not CDN-hosted — noted as a caveat per this brief's own "no numerical claims without measurement" rule):

| Metric | Value |
|---|---|
| Performance score | 94 |
| Accessibility score | 96 |
| Best Practices score | 96 |
| SEO score | 100 |
| First Contentful Paint | 0.9s |
| Largest Contentful Paint | 1.5s |
| Total Blocking Time | 0ms |
| Cumulative Layout Shift | 0.003 |
| Speed Index | 1.2s |

**LCP element** (confirmed via `PerformanceObserver` in a live page, not inferred): the headline's first word span (`"Find "`) — a **text node**, not an image or the aurora itself. This is the ideal LCP candidate (no network dependency, resolves as soon as the font is ready) and is not at risk from the background redesign as long as the new field doesn't block text paint.

**Console**: zero errors on fresh load. **DOM layer count** inside the hero's background system: 11 elements (vignette, aurora container + 4 curtains + spotlight, grid, content wrapper, dissolve). A calmer field with fewer layers should, if anything, reduce this — no regression risk expected, but will be re-measured after implementation per this brief's requirement not to claim improvement without a fresh measurement.

## 8. Accessibility — current state

- axe-core: **0 violations** on the hero, fresh run this audit (confirmed, not carried over from memory).
- All decorative background layers already carry `aria-hidden` (vignette, aurora container, grid, dissolve) — the pattern to continue for the new field.
- Focus is genuinely visible (verified via computed `box-shadow` on a real `Tab` keypress in an earlier pass): a two-ring pattern (dark inner + white outer), not a browser-default outline that could be invisible against a dark background.
- Risk to watch during implementation: any new "proof node" decorative elements must stay `aria-hidden="true"` unless they become genuinely interactive (the brief itself says decorative-only unless connected to real content) — default to decorative.

## 9. Existing analytics pattern (to extend, not replace)

Both current hero CTAs call `trackLandingCta(ctaId, section, extra?)` from [`src/lib/landingFunnel.ts`](src/lib/landingFunnel.ts), which already emits `cta_click` with `cta_id`, `section`, plus a spread `extra` bag. This brief's requested property shape (`cta_id`, `section`, `label`, `variant`) is achievable by passing `{ label: "...", variant: "signal_field" }` as the existing third argument — **no new tracking call, no new event name, no second analytics system.**

A richer tracker, `trackLandingCtaClick` in [`src/lib/landingMetrics.ts`](src/lib/landingMetrics.ts), already has a first-class `variant` field (defaulting to `"control"`) — but the hero doesn't currently call it, and every other Landing CTA uses `trackLandingCta`. Switching trackers now would be a bigger, less consistent change than extending the one already wired. **Recommendation: extend `trackLandingCta`'s existing `extra` param, don't switch trackers.**

**No active experiment/variant-assignment system exists.** `landingMetrics.ts`'s own doc comment confirms a prior `useLandingVariant` A/B hook was **retired**. Per this brief's own instruction ("do not randomly split users... without stable assignment"), I will not build a new one — `variant: "signal_field"` will be recorded as a static label, not a randomized split.

## 10. Files to change vs. protect

**May change (Hero-scoped, per this brief's own boundary):**
- `src/components/landing/KretopiaHero.tsx` — the entire implementation.
- `src/index.css` — only if a new reusable class is warranted; likely unnecessary, since the existing pattern in this exact file already does everything via inline styles referencing `hsl(var(--secondary))`/`hsl(var(--energy))` (see the now-removed electric-arc gradient, which used this exact approach) — confirmed no dead CSS remains from that removal.

**Explicitly protected (not touched by this task):**
- `src/components/Navbar.tsx` (edited in the immediately prior session turn for the "Build Your Passport" CTA rename — out of scope here, not a Hero file).
- `src/components/landing/kretopia/**` (every other Landing section).
- `src/lib/landingFunnel.ts`, `src/lib/landingMetrics.ts`, `src/lib/analytics.ts` (read-only reference; extending an existing call's arguments, not editing these files).
- `src/components/brand/BrandDots.tsx`, `src/components/brand/KretoMark.tsx` (read-only reuse of `KretoMark`, no edits).
- All routes, auth, RLS, payments, Kreto/Event/Scout logic, `supabase/functions/**`.

## 11. Implementation plan (not yet executed)

1. Remove the 4 `AuroraCurtain` elements and the cursor spotlight entirely, along with the now-unused `AuroraCurtain` helper component and its per-curtain `useTransform` calls.
2. Keep the warm vignette and the faint coordinate grid exactly as they are — both already match the brief's requirements.
3. Add **one** restrained radial field: `radial-gradient(ellipse at 50% 45%, hsl(var(--secondary) / 0.5), hsl(var(--energy) / 0.16) 45%, transparent 72%)` or equivalent — grey-to-pink, one focal region, soft edge, positioned centered/slightly below the content column (behind it in stacking order). Built from tokens, not raw hex.
4. Add a small number (3-6) of subtte "proof node" dots/short connecting lines — decorative `aria-hidden` SVG or divs, low opacity, using `--energy`/`--secondary`, positioned around the radial field's edge. No labels, no numbers, no fake data.
5. Add `<KretoMark variant="bare" size="sm" className="opacity-20 sm:opacity-25" />` (or similar low-opacity, small-size treatment) as a subtle signal within the composition — not a watermark, not interactive, not carrying an activity `state`.
6. Replace the 4-curtain pointer-parallax with a single, capped-movement response: the radial field's center offsets a small amount toward the pointer (spring-smoothed, same technique as today but one field instead of four independent layers) — satisfies "signal field subtly follows the pointer, capped movement, no large parallax."
7. Preserve the entrance word-reveal animation, both CTAs' markup/classes/routes/`onClick` handlers verbatim, extending only the `trackLandingCta` calls' `extra` argument with `{ label, variant: "signal_field" }`.
8. Re-verify reduced motion renders a fully static field (no drift, no pulse) — same gating pattern as today.
9. Re-measure Lighthouse + axe-core after the change; do not claim improvement without the fresh numbers.

## 12. Browser test plan (to run after implementation)

Breakpoints: 390×844, 768×1024, 1440×900 (per this brief's §13 — a subset of §9's fuller list, prioritized first). For each: fresh load, confirm the field reads as calm/midnight-dominant (not colorful), confirm H1 is the first visual read, confirm CTA is visibly above the fold and second in priority, confirm exact copy (pending the §5 decision), click-test both CTAs and confirm exact routes/params, keyboard-focus both CTAs, toggle reduced motion, check Day/Night contrast (see prior `LANDING_DAY_NIGHT_VISUAL_QA.md` finding that the app is currently hard-locked to dark/midnight theme for all users — Day mode is not reachable today, will note as `DEFERRED`/not independently reachable rather than fabricate a Day-mode screenshot), check console/network for errors, check for horizontal overflow and layout shift.

## Summary of flags requiring a decision before or during implementation

- **§0.1**: five commits (including the current live copy) have no open PR — operational, needs a PR opened regardless of this task's outcome.
- **§5**: this brief's assumed "approved copy" is stale; recommend keeping the current GTM copy unless told otherwise. **Not resolved in this audit — implementation will proceed on the assumption that copy is out of scope for this pass (background/CTA-styling only) unless corrected.**
- **Day mode**: not reachable by any real user today (app-wide dark/midnight lock, documented in a prior QA report) — Day/Night contrast verification will be partial by necessity, not a gap in this task's execution.

`LANDING_HERO_AUDIT_COMPLETE`
