# Scout Design System Reference

**Purpose:** Scout (`/scout`) is the canonical "what good looks like" implementation for the upcoming UX consistency pass across Spotlight, Verified Credits, Founding Circle, Creative Circle, and Admin Panel. This document records exactly what Scout does today — every claim is cited to a file and line — so an engineer can use it as a line-by-line checklist when bringing another page up to the same standard.

**Method:** Full read of `src/pages/Scout.tsx`, one level deep into every component it imports (`FeaturePageHeader`, `ScoutedGigsSection`, `ShortlistedGigs`, `OpportunitiesFeed`, `SurfaceProactiveCards`, `KretoTip`), plus the design-token source (`src/index.css`, `tailwind.config.ts`) and the app shell (`src/App.tsx`) that wraps Scout with the shared navbar. Confirmed live against a running dev server at `http://localhost:8080/scout` (desktop 1280×900 and mobile 375×812 viewports), including computed-style checks via JS (`getComputedStyle`) for background colors and container padding/max-width — not just visual screenshots.

---

## 1. Global background

Scout's page root does **not** hardcode a color — it uses the semantic token:

```tsx
// src/pages/Scout.tsx:42
<div className="accent-scout min-h-screen bg-background pb-24">
```

`bg-background` resolves from `--background`, which is theme-dependent:
- Dark mode: `240 18% 5%` = `#0B0B10` (`src/index.css:145`)
- Light mode (app default, see §17 note below): `36 27% 97%` = warm cream (`src/index.css:17`)

**However**, the header band (rendered by `FeaturePageHeader`, which Scout mounts at the top) forces a hardcoded dark plate **independent of theme**:

```tsx
// src/components/features/FeaturePageHeader.tsx:30-33
<div
  className="dark relative overflow-hidden pt-[env(safe-area-inset-top)]"
  style={{ backgroundColor: "#05070D" }}
>
```

Live-verified: `getComputedStyle` on this element returns `rgb(5, 7, 13)` = exactly `#05070D`, distinct from the body's `#0B0B10`. This is the "dark cinematic" plate — it always renders dark even if the rest of the app is in light mode, because of the `dark` class plus the inline `backgroundColor`.

**Layer stack inside the header** (all `position: absolute; inset: 0` siblings inside the `relative` wrapper, in DOM/paint order):
1. Aurora radial gradient — `src/components/features/FeaturePageHeader.tsx:35-39`
2. Grid/quadrille texture — `src/components/features/FeaturePageHeader.tsx:41`
3. Grain (SVG noise, blend-overlay) — `src/components/features/FeaturePageHeader.tsx:43-50`
4. Content (`z`-unset, follows normal stacking above the `aria-hidden` decorative layers since they're painted first in source order and have no positive `z-index`) — `src/components/features/FeaturePageHeader.tsx:51`

Below the header, the body content (`ScoutedGigsSection`, `ShortlistedGigs`, `OpportunitiesFeed`) sits on plain `bg-background`/`bg-card` tokens with **no aurora, grid, or grain** — those effects are exclusive to the header band.

## 2. Top navigation

Scout does **not** render its own navbar. It's wrapped by the app-level shared navbar, mounted once in the router shell:

```tsx
// src/App.tsx:290-291
{showNavbar && <Navbar user={user} />}
{showBottomNav && <KretopiaBottomNav />}
```

- Desktop/tablet nav: `src/components/Navbar.tsx` — `sticky top-0 z-50` (`Navbar.tsx:164`), shows a search bar and text links (Today/Studio/Scout/Passport) at `lg:` and up; collapses to a hamburger (`lg:hidden`) below that (`Navbar.tsx:453`).
- Mobile bottom tab bar: `src/components/nav/KretopiaBottomNav.tsx` — `fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border/60 bg-background` (`KretopiaBottomNav.tsx:83`).
- Also mounted app-wide alongside these (not Scout-specific): `QuickActionFab`, `ThriveAgentFab`, `KretoLauncher`, `ThriveBar` (`src/App.tsx:292-295`).

Live-confirmed at 1280×900: full text nav + search bar, no bottom tab bar (above `lg` breakpoint). At 375×812 mobile: icon-only top bar (logo + search/chat/bell/settings/hamburger icons) and the fixed bottom tab bar appears.

**Scout's own "secondary nav"** (leaving the page, not part of the shared navbar) is hand-rolled inline as plain links, deliberately *not* styled as tabs:

```tsx
// src/pages/Scout.tsx:86-104
<div className="flex items-center gap-4 flex-wrap">
  <Link to="/circle" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors" ...>
    Looking for collaborators? Open Circle <ArrowRight className="h-3 w-3" />
  </Link>
  <Link to={contextQuery ? `/talent-finder?q=...` : "/talent-finder"} ...>
    <UserSearch className="h-3 w-3" /> Hiring? Open Talent Scout <ArrowRight className="h-3 w-3" />
  </Link>
</div>
```

## 3. Typography scale

All defined in `src/index.css:883-991` ("LANDING TYPOGRAPHY SCALE") and consumed by `FeaturePageHeader`:

| Role | Class | Definition | Used at |
|---|---|---|---|
| Eyebrow | `.landing-eyebrow` | Work Sans, `10px`, `font-weight:600`, `letter-spacing:0.32em`, uppercase, `color: rgba(255,255,255,.5)` | `src/index.css:889-896`; applied `src/components/features/FeaturePageHeader.tsx:75` (color overridden inline to `#FF2DA1`) |
| H1 (white line) | `.landing-h1` | Satoshi/Inter, `font-size: clamp(1.35rem, 6vw, 4.75rem)`, `font-weight:600`, `line-height:1.08`, `letter-spacing:-0.02em`, `color:#fff` | `src/index.css:898-909`; applied `FeaturePageHeader.tsx:77` combined with `.landing-glow` |
| Accent line (pink) | `.landing-accent` | `color:#FF2DA1`, `font-style: italic`, `animation: pink-glow-breathe 4.5s` | `src/index.css:950-960`; applied `FeaturePageHeader.tsx:82`, wrapped in `<span>` after a `<br/>` |
| Subtitle | `.landing-sub` | Work Sans, `font-size: clamp(0.9375rem, 1.4vw, 1.0625rem)`, `font-weight:400`, `line-height:1.65`, `color: rgba(255,255,255,.62)` | `src/index.css:921-927`; applied `FeaturePageHeader.tsx:86` |
| Glow (static emission) | `.landing-glow` | `text-shadow: 0 0 24px rgba(255,45,161,.18), 0 0 60px rgba(255,45,161,.08)` | `src/index.css:930-937`; combined with `.landing-h1` on `FeaturePageHeader.tsx:77` |
| Card title (gig card) | inline utility | `font-bold text-base leading-tight line-clamp-2` | `src/components/opportunity/ScoutedGigsSection.tsx:297` (grid card); `text-lg` variant on the "strongest match" card, `ScoutedGigsSection.tsx:458` |
| Card body / fit-reason | inline utility | `text-[11px] leading-snug text-foreground/80 line-clamp-3` (grid card) / `text-xs leading-relaxed text-foreground/80` (strongest-match card) | `ScoutedGigsSection.tsx:316` and `:477` |
| Card meta row | inline utility | `text-[10px] text-muted-foreground` | `ScoutedGigsSection.tsx:321` |

**Note — typography is not internally consistent even within Scout's own three tabs.** `ShortlistedGigs.tsx:121` titles cards with `text-sm font-bold leading-tight line-clamp-2`, while the marketplace tab's `GigCard.tsx` uses two more variants again: `text-lg sm:text-xl font-black tracking-tight leading-[1.1]` (`src/components/opportunity/GigCard.tsx:186`) and `text-xl sm:text-2xl font-black tracking-[-0.02em] leading-[1.1]` (`GigCard.tsx:275`). There is no single "card title" style shared across Scout's three tabs — worth normalizing during the consistency pass, not just across pages.

There are also **two separate eyebrow systems** in the codebase: `.landing-eyebrow` (used by the page header, above) and `.brand-eyebrow` — `text-[10px] font-black uppercase tracking-[0.18em] text-energy` (`src/index.css:506-508`), used by the shared `EmptyState` component (`src/components/ui/empty-state.tsx:47`), which Scout's marketplace tab renders. Different font-weight (600 vs `font-black`) and letter-spacing (0.32em vs 0.18em) for what reads as the same UI role.

## 4. Title animation

Entirely owned by `FeaturePageHeader` — Scout itself has no `framer-motion` import and passes only plain strings/`ReactNode`s as props.

```tsx
// src/components/features/FeaturePageHeader.tsx:63-68
<motion.div
  initial={reducedMotion ? false : { opacity: 0, y: 18 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.85, ease: [0.2, 0.65, 0.3, 0.95] }}
  className="flex flex-col items-center gap-4 text-center"
>
```

- One `motion.div` wraps the eyebrow pill, H1, and subtitle together — **no stagger**; all three fade/slide in as a single unit.
- `initial`: `{ opacity: 0, y: 18 }` (18px below final position, transparent).
- `animate`: `{ opacity: 1, y: 0 }`.
- `duration`: `0.85s`.
- `ease`: custom cubic-bezier array `[0.2, 0.65, 0.3, 0.95]`.
- `reducedMotion` (from `useReducedMotion()`, `FeaturePageHeader.tsx:26`) short-circuits `initial` to the literal value `false`, which in framer-motion means "render immediately at the `animate` state, skip the enter transition."

There is no separate "title" vs. "subtitle" motion node — see §5.

## 5. Subtitle animation

The subtitle (`<p className="landing-sub mt-5 max-w-xl mx-auto">`, `FeaturePageHeader.tsx:86`) is a plain child **inside** the same `motion.div` described in §4 — it has no independent `motion` wrapper, no separate `initial`/`animate`, and no stagger delay relative to the H1. It animates in lock-step with the eyebrow and title as one block.

The pink accent word additionally carries its own perpetual (not entrance) animation once mounted: `.landing-accent` runs `animation: pink-glow-breathe 4.5s ease-in-out infinite` (`src/index.css:950-953`, keyframes `:961-970`) — a slow brightness/text-shadow breathing effect, separate from the framer-motion entrance.

## 6–9. Spacing scale, horizontal padding, vertical rhythm, page width

**Page width constraint (§21):** both the header and the body content wrap in the same pattern:

```tsx
// FeaturePageHeader.tsx:51
<div className="relative container mx-auto max-w-5xl px-4 pt-10 pb-8 sm:pt-14 sm:pb-12">

// Scout.tsx:110
<div className="container mx-auto max-w-5xl px-4 py-6">
```

`max-w-5xl` = `64rem` = **1024px**, and it wins over Tailwind's own `container` breakpoint max-widths (the `container` core plugin's screens config sets `2xl: 1400px`, `tailwind.config.ts:12-14`, but that's emitted before the `utilities` layer, so the `max-w-5xl` utility overrides it). Live-verified via `getComputedStyle` at a 1280px viewport: `maxWidth: "1024px"`, `paddingLeft/Right: "16px"`, rendered `width: 1024`.

**Horizontal padding (§7):** constant `px-4` = **16px** left/right at every breakpoint on both wrappers — no `sm:px-*`/`md:px-*` overrides anywhere in Scout.tsx or FeaturePageHeader.tsx. Horizontal padding does **not** change across breakpoints on this page.

**Vertical rhythm (§8, §6):**
- Header vertical padding: `pt-10 pb-8` (40px/32px) below `sm`, `sm:pt-14 sm:pb-12` (56px/48px) at `sm` (640px) and up — the *only* responsive spacing rule on the whole page (`FeaturePageHeader.tsx:51`).
- Eyebrow-pill-to-H1 gap: `mb-6` on the eyebrow pill = 24px (`FeaturePageHeader.tsx:71`).
- H1-to-subtitle gap: `mt-5` on the subtitle = 20px (`FeaturePageHeader.tsx:86`).
- Header-to-tabs gap: `mt-6` = 24px (`FeaturePageHeader.tsx:89`).
- Tab-pill-row-to-secondary-links gap: `gap-3` on the flex-col wrapper = 12px (`Scout.tsx:55`).
- Body container top/bottom padding: `py-6` = 24px, constant, no responsive variant (`Scout.tsx:110`).
- Body section spacing: `<KretoTip compact className="mb-5" />` = 20px gap before the next block (`Scout.tsx:111`); the context-query banner and `SurfaceProactiveCards` both use `mb-4` = 16px (`Scout.tsx:113`, `:121`).
- Within `ScoutedGigsSection`, sections stack with `space-y-4` = 16px (`ScoutedGigsSection.tsx:354`); within `ShortlistedGigs`, `space-y-3` = 12px (`ShortlistedGigs.tsx:107`).
- Card grids use `gap-3` (12px) in `ScoutedGigsSection`/`ShortlistedGigs` (`ScoutedGigsSection.tsx:345`, `ShortlistedGigs.tsx:85,111`) vs. `gap-4` (16px) in `OpportunitiesFeed`'s marketplace grid (`OpportunitiesFeed.tsx:430`) — another small inconsistency between Scout's own tabs.

**Card-level padding:** gig-card body padding is `p-3` (12px) in the compact grid card (`ScoutedGigsSection.tsx:301`) and `p-4` (16px) in the "strongest match" hero card (`ScoutedGigsSection.tsx:456`). The in-app detail `Dialog` uses `p-4` throughout with a `p-4 pb-3` header (`ScoutedGigsSection.tsx:522,549,626`).

## 10. Gradients used (beyond the header aurora)

| Gradient | Class/value | Where |
|---|---|---|
| Card image placeholder | `bg-gradient-to-br from-energy/30 via-primary/10 to-background` | `ScoutedGigsSection.tsx:280,446`; dialog avatar `:524` |
| Image bottom scrim | `bg-gradient-to-t from-background via-background/40 to-transparent` | `ScoutedGigsSection.tsx:284` |
| Kreto-suggests card background | `bg-gradient-to-br from-primary/12 via-primary/4 to-transparent` | `src/components/agent/SurfaceProactiveCards.tsx:159` |
| "Sunset" accent (KretoTip glow blob + CTA button) | `var(--kretopia-sunset, hsl(327 100% 59%))` | `src/components/agent/KretoTip.tsx:171,198` — **this is a flat solid color, not a gradient.** `--kretopia-sunset` is aliased to `--k-grad-full`, which the "design system reset" flattened to a single solid hue: `--k-grad-full: hsl(327 100% 59%)` (`src/index.css:216-218`). The name is a legacy holdover from a retired multi-hue brand-sheet gradient system (`src/index.css:196-203`). |

Note: `--k-midnight` (`#0B0B10`, used by `KretoTip`'s `bg-[hsl(var(--k-midnight))]/95`, `KretoTip.tsx:161`) is defined **only inside the `.dark { }` block** (`src/index.css:143,204`) — there is no `:root` fallback. The app's actual default theme is `light` (`src/main.tsx:72`, `defaultTheme="light"`), so on a fresh, never-toggled-to-dark session, `KretoTip`'s background variable would be unset. This is worth a quick manual check when auditing KretoTip's light-mode appearance during the consistency pass.

## 11. Aurora / grain effects — exact implementation

Both live only in `FeaturePageHeader.tsx` (and are duplicated, not shared, in `FeatureAITutorial.tsx` — see §"Reusable primitives" below):

```tsx
// Aurora — src/components/features/FeaturePageHeader.tsx:35-39
<div
  aria-hidden
  className="pointer-events-none absolute inset-0 ai-ambient-breathe"
  style={{ background: "radial-gradient(60% 55% at 50% 0%, rgba(255,45,161,0.14), transparent 62%)" }}
/>
```
- Inline `style`, not a utility class. `ai-ambient-breathe` (`src/index.css:994-1002`) animates `opacity` between `0.55` and `1` on a 4s ease-in-out loop; collapses to static `opacity: 0.8` under `prefers-reduced-motion: reduce`.

```tsx
// Grain — FeaturePageHeader.tsx:43-50
<div
  aria-hidden
  className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.13]"
  style={{
    backgroundImage:
      "url(\"data:image/svg+xml;utf8,<svg ...><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
  }}
/>
```
- Inline SVG `feTurbulence` noise filter, embedded as a `data:image/svg+xml` URI directly in the `style` prop (not a separate asset file).
- Blend mode: `mix-blend-overlay`.
- Opacity: `0.13` (Tailwind arbitrary value `opacity-[0.13]`).
- Static — no animation on the grain layer itself.

## 12. Graph-paper / grid effects

Confirmed: Scout's header uses the shared `.bg-grid-quadrille` utility exactly as documented in the design language:

```tsx
// FeaturePageHeader.tsx:41
<div aria-hidden className="pointer-events-none absolute inset-0 bg-grid-quadrille" />
```

```css
/* src/index.css:561-568 */
.bg-grid-quadrille {
  background-image:
    linear-gradient(to right, hsl(0 0% 100% / 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(0 0% 100% / 0.05) 1px, transparent 1px);
  background-size: 28px 28px;
  -webkit-mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 25%, transparent 90%);
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black 25%, transparent 90%);
}
```

28px×28px grid of 1px, 5%-opacity white lines, faded via a radial mask (`black 25%` → `transparent 90%`) so it reads as texture near the top of the header and disappears toward the edges — confirmed visually in the live screenshot (grid clearly visible behind "Scout." title, fading out toward the bottom of the header band). It is **only** applied inside the header band — the body content area (`ScoutedGigsSection` etc.) has no grid texture.

## 13. CTA hierarchy

Scout has **no single page-level primary CTA** — there's no hero button in the header. Hierarchy is established per-section instead, using a consistent Button-variant convention (`src/components/ui/button.tsx:14-32`):

- **Primary / filled** (`variant="default"`, `bg-primary text-primary-foreground`): "View full brief" on the strongest-match card — `ScoutedGigsSection.tsx:481`.
- **Secondary / outlined** (`variant="outline"`): "Save" (`ScoutedGigsSection.tsx:484`), "Scan now" (`ScoutedGigsSection.tsx:368`).
- **Tertiary / ghost** (`variant="ghost"`): "Dismiss" (`ScoutedGigsSection.tsx:488`), "Tune" (`ScoutedGigsSection.tsx:364`).
- The tab strip itself (`Scout.tsx:56-83`) is the closest thing to a page-level primary control — the active tab gets `bg-background text-energy shadow-sm ring-1 ring-energy` (`Scout.tsx:74`), inactive tabs get plain `text-muted-foreground hover:text-foreground` (`Scout.tsx:75`).
- Inside `KretoTip`, the CTA ("Draft a pitch" / "Shortlist for me") is a solid pink pill using the flat `--kretopia-sunset` color (`KretoTip.tsx:196-202`), visually the loudest single element on the page after the H1 accent line.
- Inside `SurfaceProactiveCards`, by contrast, the "accept" action ("Set rate", etc.) is **not** filled — it's `variant="ghost"` styled as `text-foreground` with a `Check` icon, distinguished from "Not now" only by icon and `text-foreground` vs `text-muted-foreground` (`SurfaceProactiveCards.tsx:174-196`). This is a visually weaker CTA treatment than the Button-hierarchy convention used elsewhere on the same page — worth flagging for normalization.

## 14. Loading state

Three different implementations across Scout's three tabs, all using the shared `Skeleton` component (`src/components/ui/skeleton.tsx`, `rounded-md bg-muted` + `animate-pulse`) but with different shapes:

- **Scouted (For You) tab:** `Skeleton h-6 w-48` (a fake heading) + a `grid grid-cols-1 sm:grid-cols-2 gap-3` of two `Skeleton h-72 w-full rounded-2xl` blocks — `ScoutedGigsSection.tsx:341-350`.
- **Shortlist tab:** `grid grid-cols-1 sm:grid-cols-2 gap-3` of two `Skeleton h-56 w-full rounded-2xl` — `ShortlistedGigs.tsx:83-90`.
- **Open Gigs (marketplace) tab:** three shadcn `<Card>` (`rounded-lg`, not `rounded-2xl`) each containing `Skeleton h-5 w-3/4`, `h-4 w-full`, `h-4 w-1/2` — `OpportunitiesFeed.tsx:382-390`.

The marketplace tab's skeleton uses a fundamentally different radius (`rounded-lg` via `Card`) than the other two tabs' raw `rounded-2xl` skeletons — another internal-to-Scout inconsistency worth normalizing.

Additionally, `ScoutedGigsSection` has a **scan-in-progress** state distinct from the initial-load skeleton: a `Card` with a spinning `Loader2` icon and live elapsed-seconds counter — `ScoutedGigsSection.tsx:388-396`, driven by `scanElapsed`/`setInterval` state (`:94,146-147`).

## 15. Empty state

Also three different implementations/copy across Scout's three tabs:

- **Scouted tab** — plain dashed card, one line of copy:
  ```tsx
  // ScoutedGigsSection.tsx:398-401
  <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
    No scouted gigs yet. Tap <span className="font-semibold text-foreground">Scan now</span> to find real jobs across the web matched to your skills.
  </Card>
  ```
- **Shortlist tab** — dashed card with an icon badge, title, and description:
  ```tsx
  // ShortlistedGigs.tsx:93-104
  <Card className="p-8 text-center border-dashed">
    <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
      <Bookmark className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="text-sm font-semibold text-foreground mb-1">Nothing shortlisted yet</p>
    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
      Tap the bookmark on any scouted gig to save it here. Great for stacking applications to do later.
    </p>
  </Card>
  ```
- **Open Gigs (marketplace) tab** — the shared `EmptyState` component (`src/components/ui/empty-state.tsx`), the most fully "designed" of the three: `w-20 h-20 rounded-2xl border-2` icon orb with `shadow-glow-lime`, `.brand-eyebrow`, `text-xl font-black tracking-[-0.02em]` title, `text-sm text-muted-foreground max-w-xs` description, and a filled `variant="lime"` primary action button plus a ghost secondary action — `OpportunitiesFeed.tsx:393-426`, `empty-state.tsx:26-68`. Copy varies further by filter state and by a `pickTone`/`pickVoice` A/B tone system (`OpportunitiesFeed.tsx:399-423`).

None of the three share a component or a copy voice. This is the single clearest internal-consistency gap on the page itself — the exact kind of thing the broader pass should catch, since Scout's own three tabs don't agree with each other before you even get to the other pages.

## 16. Responsive breakpoints actually used

Tailwind config (`tailwind.config.ts:16-22`): `xs:475px`, `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`.

Grep of every file in Scout's render tree for breakpoint prefixes:

- **`Scout.tsx` itself: zero responsive classes.** The page composition (tab strip + secondary links + body container) is breakpoint-agnostic; it relies on `flex-wrap` (`Scout.tsx:86`) and its children for adaptation.
- `FeaturePageHeader.tsx`: only one responsive rule, `sm:pt-14 sm:pb-12` (`:51`).
- `ScoutedGigsSection.tsx`: `sm:grid-cols-2` (`:345`), `hidden sm:inline` (`:366`), `sm:basis-[60%]`/`sm:basis-[46%] lg:basis-[31%]` on carousel items (`:408,503`), `sm:flex`/`sm:aspect-auto sm:w-64` on the hero card (`:434,436`), `hidden sm:flex` on carousel prev/next arrows (`:508-509`). No `md:` or `xl:` usage at all.
- `ShortlistedGigs.tsx`: only `sm:grid-cols-2` (`:85,111`).
- `OpportunitiesFeed.tsx`: `hidden sm:inline` (`:191`) and `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` (`:430`) — the one place `md:` and `xl:` are used, and it skips `lg:` entirely.

Net: `sm` (640px) is the dominant, almost exclusive breakpoint across Scout's tree. `md`/`xl` appear exactly once (the marketplace grid); `lg` is used once for a carousel basis. This is a narrow, inconsistent breakpoint vocabulary — a page being brought up to this standard should probably not assume `md:`/`lg:` will be exercised much if it copies Scout's patterns literally.

## 17. Reduced-motion behavior

Scout respects `prefers-reduced-motion` at three levels:

1. **Global CSS collapse** — applies to every animation/transition on the page regardless of component-level opt-in:
   ```css
   /* src/index.css:872-881 */
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
       scroll-behavior: auto !important;
     }
   }
   ```
2. **Hook-driven conditional variants** — `src/hooks/useReducedMotion.ts` wraps `matchMedia("(prefers-reduced-motion: reduce)")` and updates live via a `change` listener (not just at mount). Consumed by:
   - `FeaturePageHeader.tsx:26,64` — sets framer-motion `initial` to `false` (skips the fade/slide-up entrance) when reduced.
   - `ScoutedGigsSection.tsx:102,405,500` — sets the Embla carousel's `duration` option to `0` (vs. `20`) when reduced, disabling drag momentum easing.
   - `FeatureAITutorial.tsx:47,68,127` — swaps the sparkle icon's `pink-glow-breathe` class for a static one, and passes `autoPlay={!reducedMotion}` to the tutorial stepper.
3. **CSS-level per-utility fallbacks** — several of the bespoke keyframe utilities used in this render tree (`.landing-glow`, `.landing-accent`, `.pink-glow-breathe`, `.ai-ambient-breathe`, `.ai-orbit-ring`) each carry their own `@media (prefers-reduced-motion: reduce)` override that swaps the animation for a static equivalent (text-shadow, fixed opacity, etc.) rather than just deleting the effect — `src/index.css:935-937, 955-960, 971-976, 1001-1002, 988-990`.

## 18. Focus states

Inconsistent across the page:

- **Buttons** (shared `Button` component) get a real, styled focus ring by default: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (`src/components/ui/button.tsx:11`) — every `<Button>` on Scout (Scan now, Tune, Save, Dismiss, View full brief, etc.) inherits this automatically.
- **Custom clickable gig cards** (the `div role="button"` cards, not `<Button>`) explicitly add a brand-colored ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-energy` — `ScoutedGigsSection.tsx:268` (grid card), `:434` (strongest-match card).
- **The tab strip buttons** (`Scout.tsx:65-80`) have **no explicit `focus-visible:` classes at all** — no `outline-none`, no custom ring. They fall back to the browser's native default focus outline (not suppressed, but also not styled to match the brand — a gap relative to the rest of the page's focus treatment).
- The secondary nav `<Link>`s (`Scout.tsx:87-103`) also have no explicit focus styling beyond the browser default.

## 19. Keyboard navigation

No custom roving-tabindex or arrow-key handling for the `role="tablist"` (`Scout.tsx:56-83`) — it relies on native tab order through the three `<button role="tab">` elements; `aria-selected` is set correctly (`Scout.tsx:68`) but there's no `onKeyDown` for Left/Right arrow keys, which is what the full ARIA Tabs pattern expects.

Explicit keyboard handling **does** exist for the two non-button "clickable card" surfaces, which manually replicate button semantics since they're `<div role="button">`:

```tsx
// ScoutedGigsSection.tsx:264-266 (grid card) and :430-432 (hero card)
role="button"
tabIndex={0}
onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDetail(g); } }}
```

Everything else (actual `<button>`/`<Link>`/shadcn `<Button>` elements) relies on native semantics with no extra JS.

## 20. Mobile menu

Scout has no page-specific mobile nav/menu — it fully relies on the shared app-level components:

- `Navbar` (`src/components/Navbar.tsx`) collapses its desktop text links behind a hamburger (`lg:hidden` trigger, `Navbar.tsx:453`) below the `lg` (1024px) breakpoint.
- `KretopiaBottomNav` (`src/components/nav/KretopiaBottomNav.tsx:83`, `fixed bottom-0 ... lg:hidden`) provides the mobile primary navigation (Home / Passport / + / Opportunities / Studio), confirmed live in the 375×812 screenshot.
- Confirmed live: at mobile width, Scout's own tutorial trigger also collapses its label — `<span className="hidden sm:inline">How this works</span>` (`FeatureAITutorial.tsx:89`) — leaving an icon-only pill, consistent with the rest of the page's `sm:`-only responsive vocabulary (§16).

## 21. Page width constraints

Covered in detail in §6–9: both the header and body content cap at `max-w-5xl` (1024px), centered with `mx-auto`, live-confirmed via computed styles at a 1280px viewport (`maxWidth: "1024px"`, container `width: 1024px`, i.e. 128px of margin per side). No page-level `container` breakpoint behavior beyond that fixed cap is exercised — the `2xl:1400px` container config (`tailwind.config.ts:12-14`) never applies here because `max-w-5xl` always wins.

---

## Reusable primitives already available

Reuse these — do not recreate them on the pages being brought up to standard:

| Primitive | File | Notes |
|---|---|---|
| **Page header shell** (eyebrow pill + H1 + accent line + subtitle + tab-strip slot, with the dark plate/aurora/grid/grain, and the framer-motion entrance) | `src/components/features/FeaturePageHeader.tsx` | Already a real shared component with a typed props interface (`eyebrow`, `title`, `accentTitle`, `subtitle`, `tabs`, `tutorial`). **Already imported by** `Admin.tsx`, `Circle.tsx`, `Clients.tsx`, `CreativeCircle.tsx`, `FoundingMember.tsx`, `Match.tsx`, `Meetup.tsx`, `Profile.tsx`, `Recordings.tsx`, `Subscription.tsx`, `ThrivePay.tsx`, `WorkHome.tsx` — meaning **Admin Panel (`Admin.tsx`), Creative Circle (`CreativeCircle.tsx`), and Founding Circle (`FoundingMember.tsx`) already use this component.** The consistency pass for those three may be more about auditing/aligning their existing usage than wiring up something new. `Spotlight.tsx` and `CreditVerify.tsx` (likely "Verified Credits") do **not** currently import it — confirmed by grep, no `FeaturePageHeader` match in either file. |
| **Title/subtitle entrance animation** | Inside `FeaturePageHeader.tsx:63-68` | Already extracted — it is *not* Scout-specific inline code, it's baked into the shared header component every one of the pages above already gets for free by using `FeaturePageHeader`. There is no separate `AnimatedFeatureTitle` component because it was never split out — it's inline **inside a component that's already shared**, which achieves the same practical reuse. If you want a standalone `AnimatedFeatureTitle`, it would mean extracting `FeaturePageHeader.tsx:63-88` out, but this is optional since the wrapping component already provides reuse. |
| **Reduced-motion hook** | `src/hooks/useReducedMotion.ts` | Shared, live-updating. Already used by `FeaturePageHeader`, `ScoutedGigsSection`, `FeatureAITutorial`. |
| **`.bg-grid-quadrille` grid texture utility** | `src/index.css:561-568` | Shared CSS utility, already used correctly by Scout via `FeaturePageHeader`. |
| **`.landing-h1` / `.landing-eyebrow` / `.landing-sub` / `.landing-accent` / `.landing-glow` typography classes** | `src/index.css:883-991` | Shared CSS classes, not React components — any page can apply them directly. |
| **AI tutorial trigger + modal** | `src/components/features/FeatureAITutorial.tsx` | Shared, already wired into `FeaturePageHeader` via the `tutorial` prop. |
| **Skeleton primitive** | `src/components/ui/skeleton.tsx` | Shared, correctly reused across all three of Scout's tabs — only the *shapes/sizes* built from it diverge (see §14). |
| **EmptyState component** | `src/components/ui/empty-state.tsx` | Shared and well-designed, but only one of Scout's three tabs (marketplace) actually uses it — the other two hand-roll their own empty-state markup (see §15). Standardizing on `EmptyState` everywhere (including inside Scout itself) would be a quick, high-value fix. |
| **Button variant system** (`default`/`outline`/`ghost`/`hero`/`lime`/`glass`/etc.) | `src/components/ui/button.tsx` | Shared, and the CTA-hierarchy convention in §13 already follows it — reuse variant names, don't invent new inline button styling. |

Scout-specific / currently hand-rolled inline (would need extraction before another page could cleanly reuse them):

| Pattern | File:line | Why it's not yet reusable |
|---|---|---|
| **Aurora radial-gradient + SVG-grain layers** | `FeaturePageHeader.tsx:35-50`, duplicated again (aurora only, no grain) in `FeatureAITutorial.tsx:112-119` for the tutorial modal's dark plate | Implemented twice as raw inline `style` objects with a hand-typed `data:image/svg+xml` URI, not a shared "cinematic plate" component or CSS class. If a third surface needs this treatment, it should become a `<CinematicPlate>` wrapper (or a `.bg-aurora-grain` composite utility) instead of a third copy-paste. |
| **`#05070D` hardcoded dark-plate color** | `FeaturePageHeader.tsx:32`, `FeatureAITutorial.tsx:113` | Two independent literals, not a CSS variable — `--k-midnight` (`index.css:204`, `#0B0B10`) is a *different, close-but-not-equal* value that exists in the token system and isn't the one actually used here. Worth deciding whether `#05070D` should become its own token (e.g. `--cinematic-plate`) so it isn't a magic string in two files (and counting). |
| **Gig-card visual system** (image scrim gradients, fit-score badge, "why this fits you" callout box, `rounded-2xl` card shell) | `ScoutedGigsSection.tsx:259-338, 426-495` | Fully inline in the page-level component, not a standalone `<GigCard>`-style export (contrast with the marketplace tab, which *does* use a shared `GigCard` — `src/components/opportunity/GigCard.tsx`). Two visually-similar-but-not-identical gig card implementations exist side by side within Scout itself. |
| **Empty-state copy/markup for the Scouted and Shortlist tabs** | `ScoutedGigsSection.tsx:398-401`, `ShortlistedGigs.tsx:93-104` | Hand-rolled, not using the shared `EmptyState` component that the marketplace tab already uses (§15). |
| **`SurfaceProactiveCards` CTA styling** | `SurfaceProactiveCards.tsx:174-196` | Ghost-only button treatment that doesn't follow the primary/secondary/tertiary Button-variant convention used everywhere else on the page (§13) — inline, one-off. |
