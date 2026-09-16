# Landing Hero — CTA Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED`

## What changed vs. what didn't

**Nothing about the CTAs themselves changed in this pass** — the Signal Field task was a background-only redesign. This report documents that the CTA contract survived the background change intact, verified rather than assumed.

## Primary CTA

- Text: **"Build My Passport"** (exact)
- Route: `/auth?tab=signup&src=hero_passport` (unchanged)
- Class: `btn-landing-primary` — canonical grey-to-pink gradient (`hsl(var(--secondary))` → `hsl(var(--energy))`), the same class used by `InlineSignupBar` and `ClosingCTASection` elsewhere on Landing. Toned down in an earlier pass (single soft shadow, no multi-layer glow ring) — unchanged by this pass.
- Real `<Link>` (React Router), not a styled `<div>` — no nested clickable content, no fake loading state, no auto-navigation.
- Analytics: `trackLandingCta("hero_build_passport", "hero", { label: "Build My Passport", variant: "signal_field" })` — extends the existing call's `extra` argument rather than introducing a new tracker (see `LANDING_HERO_SIGNAL_FIELD_AUDIT.md` §9 for why). Fires once per click, verified via a unit test asserting `toHaveBeenCalledTimes(1)`.

## Secondary CTA

- Text: **"Explore Opportunities"**
- Route: `/auth?next=/scout&src=hero_explore` (unchanged) — matches the existing Scout chapter's own CTA pattern (`LandingBelowFold.tsx`), so a visitor who clicks either one lands in the same place.
- Class: `btn-glass btn-glass-outline` — the site's restrained secondary-button family, lower visual weight than the primary by design.
- Same real-link, same-size treatment as the primary (equal `px-7 py-3.5 text-base font-semibold`), differing only in fill — deliberately not competing with signup.
- Analytics: `trackLandingCta("hero_explore_opportunities", "hero", { label: "Explore Opportunities", variant: "signal_field" })`, same one-fire-per-click contract, unit-tested.

## Verified, not assumed

- **Visible above the fold** at 390×844, 768×1024, and 1440×900 — confirmed via screenshot at each.
- **Focus is visible**: confirmed in an earlier session pass via a real `Tab` keypress + computed `box-shadow` read (two-ring pattern, not a browser-default outline that could vanish against the dark background). Unchanged by this pass since no CTA CSS was touched.
- **Touch-friendly**: `py-3.5` (14px vertical padding) plus font line-height comfortably clears the 44px touch-target guideline.
- **No route regression**: both hrefs asserted byte-for-byte in the new unit test suite (`src/components/landing/__tests__/KretopiaHero.test.tsx`).
- **One event per activation**: asserted via `toHaveBeenCalledTimes(1)` per CTA in the same suite.

## Secondary CTA redundancy check

Per this brief's instruction to remove the secondary CTA only if the audit proves it redundant or misleading: it is neither. "Explore Opportunities" routes to a materially different destination (`/scout`) than the primary ("Build My Passport" → signup), giving a visitor who isn't ready to build a Passport yet a lower-commitment way to see what the product actually offers first. Kept as-is.

## No dark patterns, confirmed by omission

No scarcity language, no fake counts, no coercive wording, no disabled page access pending signup, no auto-redirect to Auth — none of these exist in the current CTA copy or behavior, confirmed by reading the full component source, not just the visible strings.
