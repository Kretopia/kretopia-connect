# Menu Modal — UX Redesign Report

## Before

`Navbar.tsx`'s Menu `Sheet` rendered every item (Workspace/Explore/More
sections, and the Company-account variant's Inbox/Company Page/Talent
Manager) as a stacked, full-width, single-column list of `h-12` rows
(`MenuButton`) inside a `w-[85vw] sm:w-[400px]` panel — never a grid,
just a long scrollable column of ~14-18 rows.

## After

New `MenuGridTile` + `MenuGrid` components, used for every pure
navigation item in both the Daily Driver menu (Workspace/Explore/More)
and the Company menu (Inbox/Company Page/Talent Manager):

- `grid-cols-[repeat(auto-fill,minmax(84px,1fr))]` — deliberately *not*
  Tailwind's `sm:`/`lg:` breakpoint prefixes, which key off viewport width,
  not the Sheet's own rendered width (85vw on mobile scales from ~320px to
  600px+ depending on device; a fixed breakpoint-based grid would either
  cram too many columns on a narrow phone or leave one column stranded on
  a wide one). `minmax`+`auto-fill` adapts to whatever width the panel
  actually has.
- Each tile: icon, label, `min-h-[76px]` (touch-friendly target),
  consistent card dimensions, `hover`/`focus-visible` states, `aria-label`
  and `aria-current="page"` for the active route — matching the existing
  `MenuButton`'s active-state convention (`bg-energy/10` highlight).

**Deliberately left as full-width rows, not grid-ified**: the Account
section (Subscription button with tier badge, StorageMeter,
AccountSwitcher), the Company menu's Settings row, and Sign Out. These
carry complex content (badges, toggles, secondary text, a destructive
action) that doesn't fit an icon+label tile — grid-ifying them would have
made them harder to read, not easier.

**Not changed**: the navbar's own top bar/buttons (per the spec, only the
Sheet's internal layout changes); the actual menu items, routes, and
feature-flag/permission gates (`isManagerMode`, the hardcoded admin-UUID
check) — all identical to before, just re-laid-out.

## Verified

- **Live in the browser**: opened the Menu, confirmed Workspace (2 tiles),
  Explore (6 tiles, 3×2), and More (4 tiles) all render as a real
  responsive grid with consistent card sizing — no narrow single-column
  list. Clicked "KrePay" and confirmed it both closed the Sheet and routed
  to `/thrivepay` correctly (the exact page rendered, "KrePay. Get paid,
  all in one place." confirmed on screen).
- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
  `npm run build` — clean. `npx eslint src/components/Navbar.tsx` — clean
  (also fixed two pre-existing `icon: any` props — on both the new
  `MenuGridTile` and the existing `MenuButton` it sits beside — to a
  proper `ComponentType<{ className?: string }>` type while already
  touching this exact code, rather than leaving one correctly typed and
  one not).

## Not independently verified

Keyboard-only tab order through the new grid (each tile is a real
`<button>` with existing focus-visible styling, but not manually tabbed
through). Mobile viewport rendering of the grid specifically (verified at
the default desktop-sized Browser pane viewport, where the Sheet still
renders at its `sm:w-[400px]` fixed width — the `85vw` mobile-width
behavior was not independently re-screenshotted this pass, though the
`auto-fill`/`minmax` approach is designed specifically to handle that
range without further changes).
