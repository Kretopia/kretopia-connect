# Landing Hero — Visual Overhaul Report (Verified Creative Signal Field)

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED`

## What was replaced

The prior background — four blurred "aurora curtain" divs plus a cursor-following spotlight, spanning five distinct hues (emerald green, teal, violet, brand pink, and an off-brand mint) composited with `mix-blend-mode: screen` — is removed entirely from [`KretopiaHero.tsx`](src/components/landing/KretopiaHero.tsx), along with its now-unused `AuroraCurtain` helper component and per-curtain `useTransform` calls.

## What replaced it: Verified Creative Signal Field

Four layers, back to front:

1. **Warm vignette** — unchanged from before this pass (not part of the aurora, already restrained).
2. **One radial field** — `radial-gradient(circle, hsl(var(--secondary) / 0.55) 0%, hsl(var(--energy) / 0.22) 42%, transparent 72%)`, centered behind the content column. Built from the same two tokens as `.btn-landing-primary`'s own gradient (`--secondary` grey, `--energy` pink) — not a new color pairing, and no raw hex.
3. **Proof nodes** — a decorative SVG with 6 dots and 6 thin connecting lines in a loose constellation pattern (`hsl(var(--energy) / 0.35-0.55)`), standing in for "scattered work becoming a verified record" per the brief's own metaphor. No numbers, no labels, no claim of live data — purely geometric.
4. **KretoMark** — the official K-mark component ([`src/components/brand/KretoMark.tsx`](src/components/brand/KretoMark.tsx)), `variant="bare"` (no surrounding surface, no pulse/activity state), small/medium size depending on breakpoint, at 20% opacity, positioned above the eyebrow line. Not a watermark, not interactive, not a generic AI orb — the same asset `BrandLogo` uses in the navbar.
5. **Faint coordinate grid** — unchanged (already matched the brief before this pass).

## Why these specific colors, not a judgment call

`src/index.css:80-83` defines four "Signal Triad" CSS variables (`--signal-pink`, `--signal-amber`, `--signal-violet`, `--signal-teal`) that are **all set to the same value**, with the comment *"retired triad member — now = accent"*. This is direct evidence the design system already made this exact decision — one dominant pink accent, not a multi-hue rainbow — before this task began. The Signal Field is built to match that existing, deliberate consolidation, not to introduce a new opinion about brand color.

Green was avoided entirely: it's reserved for KrePay elsewhere in the product, and the prior aurora's dominant emerald tone was a direct conflict with that reservation, confirmed during the audit.

## Visual hierarchy verified

Text (eyebrow → H1 → supporting line → body copy) reads first; the CTA pair reads second; the Signal Field is visually subordinate to both at every breakpoint checked (390×844, 768×1024, 1440×900) — confirmed via screenshot at each, not assumed. Nothing in the field competes for attention: max opacity on any single field layer is 0.55 (the field's own inner stop), and the proof-node SVG is capped at 0.32 overall opacity.

## Fixed during this pass: KretoMark/eyebrow overlap on mobile

The first implementation positioned KretoMark at `top-[8%]` with a fixed large size, which overlapped the eyebrow text ("FOR CREATIVE PROFESSIONALS") at 375px width. Corrected to a fixed `top-6`/`top-8` offset (not viewport-percentage-based) with a smaller mark on mobile (`size="sm"`) and medium on larger screens — re-verified with no overlap at 375×812.

## Known local-only rendering artifact (not a defect)

`KretoMark` renders the same `kretopia-k-mark.png.asset.json`-backed image already used by `BrandLogo` in the navbar. In this local dev/build environment, that asset resolves through a Lovable-specific `/__l5e/assets-v1/...` proxy path that only works through Lovable's own hosting — locally it 404s into the SPA shell (200 OK, HTML instead of PNG), so the mark shows as a broken-image glyph in every screenshot in this report. This was independently diagnosed and confirmed in an earlier session pass (same root cause as the navbar logos reported broken then) — not a regression from this change, and expected to render correctly on the actual Lovable-hosted preview/production.
