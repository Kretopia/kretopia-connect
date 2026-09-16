# UX Navigation Audit

Scope: every navigation surface — hamburger menu, bottom mobile nav, top desktop nav — cross-referenced for duplicate destinations. `src/components/Navbar.tsx` (hamburger + top nav), `src/components/nav/KretopiaBottomNav.tsx` (the live bottom nav).

## Setup facts

- **Live bottom nav:** `KretopiaBottomNav.tsx`, mounted globally in `App.tsx:296`.
- **Dead bottom nav:** `src/components/BottomNav.tsx` is only imported by `PartnerDirectory.tsx`, whose route (`/partner-directory`) redirects to `/` (`App.tsx:486`) — so it never mounts. Confirmed dead code, not a live duplicate source. Left alone (removing dead files is a separate, already-established discipline from an earlier phase; not conflated with navigation cleanup here).

## Every navigation item

**Hamburger — individual accounts** (`Navbar.tsx:337-424`): Subscription, KrePay, Clients, Manager Mode (conditional) · Stages `/circle`, Kreto `/kreto`, Match `/match`, Search `/search`, Kretopia `/thrivein`, Perks `/perks`, Events `/meetup`, **Sound Stages `/soundstages`**, Recordings `/recordings` · Verified Credits `/credits`, Founding Circle `/founding-member`, Creative Circle `/creative-circle` · Settings (+ tab variants), Feedback, Help Centre `/help`, About `/about`, Admin (conditional) · Sign Out.

**Hamburger — company accounts** (`Navbar.tsx:310-335`): Inbox `/inbox`, Company Page, **Find Talent `/talent-finder`**, Talent Manager (conditional), Subscription, Settings.

**Bottom nav** (`KretopiaBottomNav.tsx`) — individual: Home `/`, Passport `/profile`, Opportunities `/opportunities`, Studio `/desk`. Company: Studios `/desk`, Gigs `/opportunities`, **Talent `/talent-finder`**, Pay `/thrivepay`.

**Top desktop nav** (`Navbar.tsx`) — individual: Today `/`, Studio `/desk`, Scout `/scout`, Passport `/profile`. Company: Studios `/desk`, Gigs `/opportunities`, **Talent `/talent-finder`**, Pay `/thrivepay`.

## Confirmed duplicates

1. **`/talent-finder` — genuine 3-way duplicate for company accounts.** "Find Talent" (hamburger) + "Talent" (bottom nav) + "Talent" (top desktop nav) all point to the same route, and the hamburger trigger has no viewport-hiding class, so it's reachable at every breakpoint including desktop where the inline link is already visible.

2. **"Stages" (`/circle`) vs "Sound Stages" (`/soundstages`) — duplicate destination experience, not a duplicate route.** Two separate hamburger entries, both using the `Theater` icon (`Navbar.tsx:373` and `:380`). `/circle` renders `LiveCallsPanel` as its main content; `/soundstages` is a standalone page rendering the *same* `LiveCallsPanel` component with no other chrome. A developer comment already flagged this overlap (`WorkHome.tsx:678-679`: "flow at /soundstages instead of a second, duplicate ..."). Same icon, overlapping labels, same underlying feed — this is the "SoundStages appears twice" finding, confirmed.

3. **Guest desktop row vs guest hamburger — not a bug.** Same `guestNavItems` array renders in both, but one is `hidden md:flex` and the other's trigger is `md:hidden` — mutually exclusive by breakpoint, intentional responsive parity.

## Routes reachable only via the hamburger (legitimate secondary nav — left untouched)

Individual: `/subscription`, `/thrivepay`, `/clients`, `/talent-manager`, `/kreto`, `/match`, `/search`, `/thrivein`, `/perks`, `/meetup`, `/recordings`, `/founding-member`, `/creative-circle`, `/settings*`, `/help`, `/admin`. Company: `/inbox`, `/profile/:id`, `/talent-manager`, `/subscription`, `/settings`.

## Recommended canonical structure

- Remove "Find Talent" from the company hamburger — already one tap away via bottom nav (mobile) and top nav (desktop).
- Collapse "Stages"/"Sound Stages" to one hamburger entry. Keep `/circle` (the fuller hub — Match/Browse/Network tabs plus the live stages feed) since `/soundstages` remains reachable from inside it and from every in-app "Join"/"Start Stage" button already wired elsewhere. Remove the standalone `/soundstages` hamburger entry.
- Everything else in the hamburger is genuinely secondary/account-level content (settings, billing, support, admin) with no cross-surface duplication — left as-is.

Implemented in the next commit (Phase 1).
