# Landing Hero Replacement — Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED`, `BROWSER_VERIFIED` at 390×844, 768×1024, 1440×900.

## What changed

`src/components/landing/KretopiaHero.tsx` — full content replacement, from a search-first hero (real global search bar as the primary action) to a direct, CTA-first hero, exactly matching the brief's required copy:

- Eyebrow: "For creatives who want their work to count" (rendered via the existing `.landing-eyebrow` class, which uppercase-transforms it — same convention every other landing eyebrow already uses).
- Headline (single `<h1>`): "Turn the work you've already done" / "into your next opportunity." — exact required text, word-by-word blur-reveal animation preserved from the prior hero (same technique, new words), gated behind `useReducedMotion`.
- Value sentence: exact required copy, unchanged.
- Primary CTA: real `<Link>` styled as a button (not a typographic link, not wrapped in a form) — "Build my Creative Passport", routing to `/auth?tab=signup&src=hero_passport`.
- Trust line: exact required copy, unchanged.
- Kept, de-emphasized: "Already have an account? Sign in" — not a signup-competing CTA, and every other primary-CTA section on this page (`ClosingCTASection`) already pairs its primary action with the same kind of secondary sign-in path, so removing it here would be inconsistent, not cleaner.

**Background/visual treatment kept**: the ambient aurora blobs, faint signal grid, and warm vignette are unchanged — no static image existed in the prior hero to "keep," and this ambient treatment is genuinely restrained (low-opacity, `useReducedMotion`-gated, `pointer-events-none`), so removing it would have been change for its own sake, not a real simplification. It doesn't compete with the new, more compact centered content.

## The one real functional question this raised, and how it was resolved

The removed search bar wasn't decorative — submitting it called `handleHeroClaimSearch` (`UnifiedHome.tsx:104`), which pre-fetches web-search results via the `search-credits-web` edge function and routes to `/auth?tab=signup&claim=1&q=...`, a real "claim your identity" onboarding shortcut. The brief is explicit that this underlying feature must not be removed.

Traced where else this remains reachable: **the persistent site navbar already has its own `UnifiedSearchDropdown` instance** (`Navbar.tsx`), but it was explicitly hidden on the landing page (`{!isLandingPage && (...)}` — a guard that existed specifically because the old hero owned that role). With the hero's search bar gone, that guard would have made the real search/claim feature completely unreachable from the landing page for a first-time guest.

**Fix**: removed the `!isLandingPage` guard from both navbar search entry points (the desktop input and the mobile search sheet) in `Navbar.tsx`, so the same real, already-proven search bar is now visible on the landing page too. Confirmed live in the browser (visible in every screenshot taken for this report). Submitting a name there still resolves to the same claim mechanism via the search results (`/profile/:id?showClaim=true`), independently confirmed by reading `UnifiedSearchDropdown.tsx`'s own result-click handling — the specific one-step "prefetch + go straight to signup with cached results" shortcut (`handleHeroClaimSearch`) is no longer the front door, but the underlying route, backend function, and claim mechanism are all untouched and still reachable.

`onSearchSubmit` was kept as an optional prop on `KretopiaHeroProps` (unused internally now) rather than removed, to avoid touching `KretopiaLanding.tsx`/`UnifiedHome.tsx`'s prop-passing in this same change — a smaller, lower-risk diff. Confirmed harmless: this project's `tsconfig.app.json` has `noUnusedParameters: false`, so this produces no type or lint noise.

## CTA styling

New canonical `.btn-landing-primary` class added to `src/index.css` — a literal grey-to-pink linear gradient (`linear-gradient(135deg, hsl(var(--secondary)), hsl(var(--energy)))`), built entirely from existing semantic tokens (no new raw hex/rgb introduced). Full hover/focus-visible/active/disabled states, reduced-motion-safe (hover lift disabled under `prefers-reduced-motion`). This is distinct from the existing `.btn-glass` system (translucent glass-over-dark-background, meant for secondary/tertiary chrome) and from a flat solid-color fill (explicitly prohibited by brand rules).

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: live in the dev server, guest session, at all three required breakpoints. Confirmed: exact copy renders, CTA visible without scrolling at every size, gradient renders correctly (not flat pink), no horizontal overflow, no layout clutter, navbar search now visible on landing (desktop input + mobile search icon), no error-boundary fallback anywhere on the page (directly queried the live DOM for both the CTA elements and any error-boundary fallback text — confirmed present/absent respectively).
- Single `<h1>` preserved (only one exists, in this file, unchanged from before).
