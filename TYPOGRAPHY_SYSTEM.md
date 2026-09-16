# Typography System

Section 2 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Selected font family: Satoshi

**Already the project's font before this pass** — not a new choice. What this pass did was find and close the gaps between "Satoshi is supposed to be the brand font" and what was actually loaded/declared.

Rationale (why Satoshi over the alternatives already present in the codebase):
- **Readability**: geometric grotesque, designed for UI use, holds up at both display sizes (landing hero) and small UI sizes (labels, buttons).
- **Kretopia brand fit**: it's what the existing landing page, `.landing-h1`/`.landing-glow` treatment, and the "Prove what you've done. Get found for what's next." title were already designed around.
- **Latin coverage / punctuation / numeric clarity**: Fontshare's Satoshi ships tabular-friendly numerals and full Latin punctuation — already relied on throughout the app (invoice amounts, dates, credit counts).
- **Weights available**: 300/400/500/700/900, loaded via Fontshare (`https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap`) — covers every weight actually used in the codebase (checked: `font-weight: 400/500/600/700/900` all appear in `src/index.css`; 600 falls back to the browser's synthetic-bold interpolation between 500 and 700, which is standard and not a defect).
- **Performance**: `display=swap` already set — no invisible-text-during-load (FOIT); text renders in the fallback immediately and swaps to Satoshi when it arrives, so no layout-blocking wait.
- **Licensing**: already in production use via Fontshare's free API tier before this pass; not a new dependency.
- **Already available**: zero migration cost — this was about *enforcing* Satoshi everywhere, not introducing it.

Rejected alternatives (both were already loaded, both are now demoted to pure technical fallbacks or removed):
- **Work Sans** — was the deliberate *subtitle/body* font on the entire landing-page system (`.landing-sub`, `.landing-eyebrow`, and inline styles in 15 landing component files) prior to this session. Replaced with Satoshi earlier this session (58 occurrences across 15 files) — see commit `65dba5ea` and prior. This is why the title and subtitle previously rendered in genuinely different typefaces.
- **Instrument Serif** — loaded via Google Fonts but never actually rendered: `src/index.css`'s `.font-serif` rule force-overrides it to Satoshi with `!important` (a pre-existing "neutralizer" comment: *"Neutralize any leftover font-serif usage so headlines don't render in Instrument Serif"*). The webfont itself was pure dead weight on every single page load — a real network request and parse cost for a font that could never visibly appear. **Removed from `index.html` this pass.**
- **Inter** — kept, but strictly as the documented technical fallback (`'Satoshi', 'Inter', ui-sans-serif, system-ui, sans-serif`), matching the brief's own allowance ("A system fallback is allowed only as a technical fallback if the primary font cannot load"). Confirmed via repo-wide grep: zero components declare Inter as their *primary* font — it never appears first in any stack.

## The canonical token

```css
:root {
  --font-family-brand: 'Satoshi', 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

Defined once, in `src/index.css`'s `:root` block. Every other font-family declaration in the codebase's shared CSS now references it instead of repeating the stack:

- `html, body` (global default)
- `.font-display`
- `.font-serif` (the neutralizer — now honestly references the brand token instead of hardcoding a duplicate copy of the same stack)
- `.landing-h1`, `.landing-h2`, `.landing-sub`, `.landing-eyebrow`

Tailwind's `fontFamily` config (`tailwind.config.ts`) was also consolidated — `sans`, `display`, `body`, and `serif` all now resolve to `var(--font-family-brand)` instead of four separately-maintained (and previously inconsistent — `body` used to list Inter *before* Satoshi) copies of the stack. This means `font-sans`, `font-display`, `font-body`, and `font-serif` Tailwind utility classes are now guaranteed identical, not just coincidentally matching.

## What was NOT changed

Roughly 25 `.tsx` files use inline `style={{ fontFamily: "'Satoshi', 'Inter', sans-serif" }}` rather than referencing the CSS variable. These are **already correct** — they render the right font, verified live — just not yet tokenized at the component level. Converting each to `style={{ fontFamily: 'var(--font-family-brand)' }}` is a real but low-priority mechanical follow-up (zero visual change, pure maintainability) not done in this pass to keep the diff focused on things with observable effect.

## Verification

- `npm run typecheck`: clean (1 pre-existing, unrelated error in `StudioAICreate.tsx`, dated 2026-08-19, not touched by this change).
- `npm run build`: succeeds, no new warnings.
- `npm run test`: 68/68 passing.
- **Live-verified**: loaded `/` (landing), confirmed via `getComputedStyle()` that both the `<h1>` and `<body>` resolve to `Satoshi, Inter, ui-sans-serif, system-ui, sans-serif`, and that `--font-family-brand` is readable from `document.documentElement`. Screenshotted — Satoshi's distinctive glyphs render correctly (not a generic system-sans fallback), confirming the Instrument Serif import removal caused no regression.
- **Not verified**: the ~125 pages not yet individually opened this pass (see `GLOBAL_UX_UI_INVENTORY.md`). They inherit the correct font structurally (via `html, body`'s CSS rule, which cascades to everything unless a component explicitly overrides it — and the grep in this pass found zero such overrides), but that's a structural guarantee, not a per-page visual confirmation.

## Files changed

- `src/index.css` — added `--font-family-brand` token; 7 declarations now reference it.
- `tailwind.config.ts` — 4 font tokens consolidated to reference the same CSS variable.
- `index.html` — removed the unused Instrument Serif Google Fonts import.
