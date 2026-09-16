# Navbar Style Rollback Report

## Regression
Commit `f66b8e399` routed **every** shadcn `Button` variant through `.btn-glass` (frosted layer, gradient fill, shimmer `::before`, hover lift, `color:#fff !important`). That system was designed for CTAs, so navbar buttons picked up glass panels and a pink shimmer border they never had. `ce4fc827b` had already pushed the navbar CTAs to `btn-pink-gradient`.

## Reference (pre-regression, `d0a2e8e2`)
Navbar CTA = solid primary fill, no shimmer, no lift. Ghost/outline nav items = standard shadcn hover on `--accent`.

## Fix
1. `<nav data-nav-chrome>` marks navbar chrome in `src/components/Navbar.tsx`.
2. `src/index.css` neutralizes `background-image`, `backdrop-filter`, `box-shadow`, hover transform and the `::before`/`::after` shimmer for `.btn-glass` **only** inside `[data-nav-chrome]`, and restores inherited text color.
3. The two "Get Started" CTAs use `nav-btn-plain bg-primary text-primary-foreground hover:bg-primary/90`.

Scope: strictly `[data-nav-chrome]` + the opt-out class. Landing, Studio, dialogs and every other CTA keep the current system — verified by grep that no other component uses `data-nav-chrome` or `nav-btn-plain`.

## Verified
Desktop + mobile nav, light and dark chrome routes, hover/focus/active, guest and authenticated states. No shimmer, no glass panel, no hover lift in the navbar; CTA contrast unchanged.
