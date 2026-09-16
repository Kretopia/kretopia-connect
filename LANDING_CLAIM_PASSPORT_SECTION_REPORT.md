# Landing Claim Passport Section — Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, `BROWSER_VERIFIED`.

## What changed

**`src/components/landing/kretopia/SearchTutorialSection.tsx`** — removed the exact content the brief named for removal: the "1 Search / 2 Review / 3 Claim" three-card summary and the "Search Your Name" button (which scrolled back up to the hero and refocused its search input — a function that no longer has anything to scroll back to, per the Hero replacement). Removed the now-unused `STEPS` array, `scrollToHeroSearch` function, and their icon imports. **Kept**: the section's eyebrow/headline/body ("Your creative history may already be here...") and its `FeatureTutorialPanel` (the deeper tutorial layer) — this section's fuller replacement with a "Kretopia loop visual" is a separate, larger piece of work (per the audit's Phase 4) with its own open placement question, not bundled into this pass.

**`src/components/landing/kretopia/InlineSignupBar.tsx`** — this section already was, structurally, almost exactly the "stronger Claim your Passport section" the brief describes (real headline, real CTA, real trust line, and — critically — already routing to the exact required URL). The one real defect: its button used a flat solid-pink fill (`style={{ backgroundColor: ACCENT }}`), the precise anti-pattern the brief prohibits. Restyled to the new `.btn-landing-primary` gradient class (same one used by the Hero), removing the `Button` wrapper in favor of a plain styled `<Link>` for consistency with the Hero's own CTA markup.

**Copy**: left unchanged ("Your work already exists. Claim the record." / "Free forever · No credit card · 2-minute setup"). This already satisfies the brief's requirement that any copy change "remain factually accurate, clearly linked to Passport creation, not repetitive with the Hero" — introducing new copy here purely for its own sake, when the existing copy already meets every stated bar, would have been change without a reason.

## The one non-negotiable preserved exactly

**CTA URL**: `/auth?tab=signup&intent=inline_bar` — byte-for-byte unchanged. Confirmed via direct DOM read in the live browser (`href` attribute on the rendered link matches exactly), not just by not having touched that line of code.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: live in the dev server. Confirmed: old "1 Search / 2 Review / 3 Claim" summary and "Search Your Name" button are gone from the page's rendered text; the section's remaining headline/body/tutorial content renders correctly with no layout gap or visual incompleteness; `InlineSignupBar`'s CTA renders with the same gradient as the Hero (visual consistency confirmed via screenshot); no console/render errors; exact CTA URL confirmed via live DOM query (`document.querySelector('#inline-signup a.btn-landing-primary')` resolves, and its `href` was independently verified unchanged from source).
