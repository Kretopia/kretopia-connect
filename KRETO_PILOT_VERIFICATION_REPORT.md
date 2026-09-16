# Kreto Pilot Verification Report (Phase A, re-verified)

Phase A (launcher, Landing Hero, Studio) shipped in the original pilot (`KRETO_3D_PILOT_IMPLEMENTATION_REPORT.md`, status `KRETO_3D_PILOT_IMPLEMENTED_NOT_VERIFIED`). This report re-verifies those same three surfaces against the *expanded* global state/size model added in this pass, since the underlying component changed.

## Status: `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` (component-level); `IMPLEMENTED` (surface-level, unchanged)

## What changed vs. what didn't

None of the three Phase A call sites changed their own code in this pass — `KretoLauncher.tsx`, `KretopiaHero.tsx`, and `KretoTip.tsx`'s Studio group all still pass `state="idle"` exactly as before, because none of them has gained a genuine non-idle signal to report. What changed is that the component underneath them now supports the full 8-state/5-size model, and this report verifies that expansion didn't regress the three live surfaces.

## Verification performed this pass

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npx eslint src/components/brand/KretoPresence.tsx src/components/brand/__tests__/KretoPresence.test.tsx` — clean.
- `npx vitest run src/components/brand/__tests__/KretoPresence.test.tsx src/components/agent/__tests__/KretoTip.test.tsx` — 25/25 passing, including new coverage for `caution`/`offline` text announcements, the `full` size K-mark badge, and the attentive-hover-doesn't-override-real-state guarantee.
- `npm run build` — clean production build.
- Live browser check at `/today` (desktop viewport, 1440×900, authenticated session): `KretoLauncher` renders unchanged, bottom-right; hovered it directly (real `mouseenter`) — no console errors or React warnings attributable to this change (the errors present in the console — a Supabase refresh-token failure and pre-existing Radix `<p>`-nesting warning inside `AccountSwitcher` — are unrelated to this component and predate this pass); the button remained visible and interactive after the hover.

## Honest limitation

The one-shot `attentive` tilt (0.4s) and the `caution`/`error`/`offline`/`success`/`proposal_ready` visual treatments are **unit-tested but not live-screenshotted**, because no Phase A surface currently has a real trigger for any of them — every live instance passes `idle`. A pixel-level live check of a transient 400ms animation is not a reliable verification method regardless; the logic that decides *which* state renders (including "hover never overrides a real non-idle state") is what's actually tested, and that is covered by the two new attentive-specific unit tests plus the existing per-state `it.each` label test.

## Not re-run this pass

Lighthouse/axe were run in full during the original pilot and hero work (`LANDING_HERO_PERFORMANCE_REPORT.md`, `LANDING_HERO_MOTION_ACCESSIBILITY_REPORT.md`, `KRETO_3D_PILOT_IMPLEMENTATION_REPORT.md`). This pass's change is additive to the same component (new state branches, no new DOM nodes on the `idle` path, no new dependency) — see `KRETO_PERFORMANCE_BUDGET_REPORT.md` for why a full re-run wasn't repeated here and what would trigger one.
