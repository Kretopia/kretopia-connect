# Landing CTA Hierarchy — Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, `BROWSER_VERIFIED`.

## What changed

**Established a real canonical primary-CTA style** (`.btn-landing-primary`, `src/index.css`) where none existed before — the audit found three different, inconsistent CTA treatments coexisting (`.btn-glass-primary`, `.btn-glass-hero`, and a flat solid-pink fill), none of which matched "grey-to-pink gradient" literally. Applied consistently to the page's two "primary" tier CTAs per the brief's own hierarchy — Hero and Closing — plus the Claim Passport section's CTA (functionally also primary-tier, being the page's early, most prominent post-hero conversion moment):

- `KretopiaHero.tsx` — "Build my Creative Passport"
- `InlineSignupBar.tsx` — "Claim your Passport"
- `ClosingCTASection.tsx` — "Claim Your Creative Passport" (replaced `.btn-glass-hero`)

**Left the "supporting" tier CTAs untouched** — the four `ChapterSection` instances (Passport/Scout/Match/Studio/Community "Build Your Passport" / "Explore Opportunities" / etc.) keep their existing, lower-visual-weight styling. Applying the loud primary gradient there too would have flattened the hierarchy the brief explicitly asks for (one dominant tier, supporting CTAs lower-weight) rather than establishing it.

**Two small, pre-existing CTA bugs fixed**, found during the audit, safe and in-scope to fix alongside this work:
1. `LandingBelowFold.tsx`'s Community-chapter CTA passed an un-encoded nested query string (`/auth?next=/circle?tab=live`) into the chapter template, which then appended its own `&tab=signup&src=...`. Worked by accident (`URLSearchParams` tolerates it), but was inconsistent with the one other place in the codebase doing the same job correctly (`MeetKretoSection.tsx`, via `encodeURIComponent`). Fixed to match.
2. `src/components/ui/cta-button.tsx`'s doc comment claimed its exact classes were "used by the Landing Page CTA (`BottomCTASection.tsx`)" — `BottomCTASection.tsx` is confirmed dead code (imported into `UnifiedHome.tsx` but never rendered), so this was stale and pointed the next reader at the wrong file. Corrected to describe `CtaButton`'s real, live usage (Studio's `StudioProjectsDashboard`/`StudioCreateHero`) and to note Landing now has its own separate `.btn-landing-primary` system.

**Checked, found already correct, not changed**: `StickyMobileCTA.tsx`'s imperative `navigate()` call already fires `trackLandingCtaClick` immediately before navigating — the audit's note that this was untracked was based on a stale read; the live file already does the right thing.

## What was deliberately not done

- **Did not touch `?intent=` values already in use elsewhere** (`inline_bar`, `closing_cta`) — confirmed dead (never read by `Auth.tsx` or any analytics helper), but harmless as inert extra query string, and "fixing" working analytics-adjacent code with no user-facing benefit is exactly the kind of unnecessary risk this brief's own safety rules warn against. The **new** Hero CTA instead uses `?src=hero_passport` — a real, live-read parameter (`resolveAuthEntrySource`, `landingMetrics.ts`) — so it doesn't repeat the same dead-parameter pattern going forward.
- **Did not touch the ~20 orphaned legacy landing files** found during the audit (each with its own `/auth` CTA, none reachable by any route) — out of scope for a CTA-hierarchy pass on the *live* page; flagged for a separate cleanup.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: all three `.btn-landing-primary` CTAs confirmed live and visually consistent across 390×844/768×1024/1440×900 (screenshots taken at each size); no two equal-weight primary CTAs ever appear in the same viewport (Hero, Claim Passport, and Closing are each their own scroll section); every CTA's `href`/`to` preserved exactly where the brief required it; no console/render errors.
