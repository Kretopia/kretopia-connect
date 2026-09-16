# Responsive / Accessibility Breakpoint Matrix

Section 12 of the Global Typography, UX/UI and AI-Powered Motion Overhaul. Compiled 2026-08-21 on branch `feature/activation-priority-plan`.

## Scope

The brief's 7 breakpoints (375×667, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900) against the same representative pages used throughout this overhaul's "foundation first" pass — landing (guest), Today (dashboard), Hire Talent, Passport, Verified Credits — plus Studio (`/desk/:id`), the newest untested surface given this session's `AutopilotProjectGuide` work. All checks are live DOM reads (`scrollWidth` vs `innerWidth` for overflow, live heading queries for hierarchy), not visual inspection alone, though several breakpoints were also screenshotted for visual confirmation.

## Overflow + heading-hierarchy matrix

| Page | 375×667 | 390×844 | 430×932 | 768×1024 | 1024×768 | 1280×800 | 1440×900 |
|---|---|---|---|---|---|---|---|
| Landing (guest) | Pass, 1 H1 | Pass, 1 H1 | Pass, 1 H1 | Pass, 1 H1 | Pass, 1 H1 | Pass, 1 H1 | Pass, 1 H1 |
| Today (dashboard) | Pass, 1 H1 | Pass | — | Pass | Pass | Pass | Pass, 1 H1 |
| Hire Talent | Pass, 1 H1 | Pass | Pass | Pass | Pass | Pass | Pass, 1 H1 |
| Passport | Pass, 1 H1 | Pass | Pass | — | Pass | — | Pass, 1 H1 |
| Verified Credits | Pass, 1 H1 | Pass | Pass | Pass | Pass | Pass | Pass, 1 H1 |
| Studio (project room) | **Fail → Fixed**, 2 H1 | Pass (post-fix) | Pass (post-fix) | Pass (post-fix) | Pass (post-fix) | Pass (post-fix) | Pass (post-fix), 1 H1 |

"—" marks a breakpoint skipped for that page after the same page passed cleanly on every breakpoint checked either side of it, to keep the sweep to a reasonable number of round trips — not a gap in the pattern, a deliberate reduction once a page showed no breakpoint-dependent behavior at all. No horizontal overflow (`scrollWidth > innerWidth`) was found on any page at any breakpoint checked.

## A real, previously-unknown bug found and fixed

**Duplicate H1 on the Studio project room** (`/desk/:id`, the "today" tab — the default view of every project), found at the very first breakpoint checked (375×667) and confirmed reproducible at every breakpoint after. Two elements both contained the literal project title:

- `SimpleProjectHeader.tsx`'s compact topbar title (`<h1 className="text-sm sm:text-base...">`) — persistent chrome shown across every tab of the project room, structurally similar to a browser tab title.
- `VibeHeader.tsx`'s main title (`<h1 className="text-3xl sm:text-4xl font-black...">`) — the real, prominent, editable page heading, rendered only within the "today" tab (`StudioRoom`).

`ThriveDesk.tsx` mounts both simultaneously whenever the "today" tab is active — the default state for every project a person opens. This is the same defect class already found and fixed once earlier in this overhaul (`ThrivePromptHero.tsx`'s duplicate H1 on the dashboard, `05f080b4`), just on a different, previously-unchecked page.

**Fixed** by changing `SimpleProjectHeader.tsx`'s compact title from `<h1>` to `<h2>` — the same zero-visual-change, tag-only fix as the earlier precedent. `<h2>` (not stripping heading semantics entirely) was chosen because this component is also used standalone on non-"today" tabs where it may be the only heading present; downgrading to `<h2>` keeps a heading landmark there while eliminating the exact-duplicate-H1 problem on "today". Re-verified live at 375, 390, 430, 768, 1024, 1280, and 1440: `h1Count: 1` at every breakpoint, `h2Count: 9` at 375px confirming the element is still present and labeled, just no longer competing with the page's real title.

**One residual, minor nit — not fixed this pass**: at 1440px the DOM's heading order reads H2 (the compact topbar) before H1 (VibeHeader's title), since the topbar sits structurally above the "today" tab's content. A screen-reader user navigating by heading would encounter the secondary label before the primary one. This is a common pattern for persistent app chrome (not unique to this fix) and doesn't break the "one H1 per page" rule, but isn't a perfectly ordered hierarchy either — flagged honestly rather than silently accepted as fully resolved.

## Keyboard navigation & focus visibility (spot check)

Tabbed through Verified Credits at 1440×900 and checked `document.activeElement`'s computed style at two stops:

- A search-bar icon button ("Search by voice"): real double-ring focus treatment (`box-shadow: 0 0 0 2px <background>, 0 0 0 4px white, ...`) — visible against the dark theme.
- The "Studio" nav link: identical treatment.

Consistent, real, visible focus indication on both a button and a nav link — not exhaustive (didn't tab through every interactive element on every page), but enough to confirm the app-wide focus system is genuinely wired, not just present in CSS unused.

## ARIA labels on the newest components

Checked `AutopilotProjectGuide.tsx` (this session's newest interactive surface) directly in source: every one of its 12 buttons has real visible text content — no icon-only, unlabeled controls. The shadcn `Sheet` primitive's own auto-injected close button carries `<span className="sr-only">Close</span>`, confirmed present and unmodified. No gaps found in this component.

## What this pass does not cover

- **Zoom (200%)** — not tested. Approximating it via a narrower viewport isn't equivalent to real browser zoom (text scale vs. layout reflow behave differently), and this session's tooling has no direct zoom control.
- **Slow network simulation** — not tested; no network-throttling control available in this session's browser tooling.
- **Screen-reader output** — not tested with an actual screen reader (VoiceOver/NVDA/JAWS); heading-hierarchy and ARIA-label checks are a proxy, not a substitute.
- **Empty/loading/error/expired-session/unauthorized states** — not systematically swept this pass. Several were incidentally exercised earlier in this engagement (e.g. the guest-mode preview technique, session-expiry re-logins) but not as a deliberate per-page matrix.
- **Full keyboard-only navigation** of an entire page or form (e.g. completing the Hire Talent form using only the keyboard) — only a 2-element spot check was done, not an end-to-end pass.
- **The other ~129 real routes** beyond the 6 checked here — this matrix, like every other report in this overhaul, covers the representative "foundation first" set, not the full route inventory documented in `GLOBAL_UX_UI_INVENTORY.md`.

## Verification

`npm run typecheck`: only the single pre-existing baseline error (`StudioAICreate.tsx`, unrelated), unchanged. `npm run build`: clean, same pre-existing chunk-size warning as baseline. `npm run test`: 68/68 passing, unchanged.
