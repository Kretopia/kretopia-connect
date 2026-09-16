# Kreto Chat Layout Report

## Bug

Kreto (the AI assistant launcher) visually overlapped the message-send button in
the 1:1 and group chat composers on desktop, and captured pointer events over
that region — the send button was unclickable underneath it.

## Root cause

`KretoLauncher` (`src/components/kreto/KretoLauncher.tsx:58-69`) is a global
widget mounted in the app shell (`src/App.tsx`), *outside* the routed page
content, on every page where a user is logged in and not on an excluded
surface. It is `position: fixed`, desktop-only (`hidden lg:flex`), pinned to
the viewport's bottom-right corner:

```
right: max(1.25rem, safe-area)   // ≈20px
bottom: max(1.25rem, safe-area)  // ≈20px
height/width: 3.5rem (56px)
```

This places its hit box at `right: 20–76px, bottom: 20–76px` from the
viewport edge, at `z-40`.

The message composer (`src/pages/messages/MessageComposer.tsx` for 1:1 chats,
an equivalent inline composer in `src/components/messages/GroupChatPanel.tsx`
for group chats) is ordinary static-flow content — no `position` or
`z-index` of its own. Its parent column
(`src/pages/Messages.tsx:196`, `:226`, `src/components/messages/GroupChatPanel.tsx:234`)
reserved bottom clearance for the *mobile* bottom nav (`pb-20`, 80px) but
stripped it entirely at the desktop breakpoint (`lg:pb-0`) — the same
breakpoint at which `KretoLauncher` turns on. With no reserved clearance,
the composer (and its send button, the last element in the row) ran flush to
the viewport's bottom-right corner, landing inside `KretoLauncher`'s fixed
hit box. Being `position: fixed`, `KretoLauncher` paints in a later
compositing layer than the composer's static content regardless of DOM
order, so it visually sat on top of and absorbed clicks meant for the send
button.

Measured overlap before the fix (1280×800 viewport, computed from the actual
CSS values above): send button box `top:744 bottom:784 left:1204 right:1244`
vs. Kreto box `top:724 bottom:780 left:1204 right:1260` — a real ~36px
vertical / full horizontal intersection.

Mobile was not affected: `KretoLauncher` is `lg:`-only, and the mobile
equivalent (`ThriveBar`, `src/components/agent/ThriveBar.tsx`) explicitly
excludes itself on `/messages` (`HIDDEN_PATH_PREFIXES`, line 29) — mobile chat
already had no floating Kreto surface to collide with.

## Fix

Reserved the same bottom clearance on desktop that already existed on
mobile, sized to clear `KretoLauncher`'s footprint (56px + 20px offset = 76px,
rounded up to Tailwind's `pb-24` / 96px for a safety margin) instead of
stripping it to zero:

- [`src/pages/Messages.tsx:196`](src/pages/Messages.tsx:196) — outer row wrapper: `lg:pb-0` → `lg:pb-24`
- [`src/pages/Messages.tsx:226`](src/pages/Messages.tsx:226) — 1:1 chat column: `lg:pb-0` → `lg:pb-24`
- [`src/components/messages/GroupChatPanel.tsx:234`](src/components/messages/GroupChatPanel.tsx:234) — group chat column: `lg:pb-0` → `lg:pb-24`

This follows the spec's preferred approach (reserve space for a fixed
element via normal flow, not z-index escalation or negative margins) and
mirrors the pattern the codebase already uses for the mobile bottom nav.

Kreto's expanded chat panel (`ThriveAgentFab.tsx`, 380×600px when open) can
still visually sit near the composer while a user has *deliberately* opened
it — that is treated as an intentional overlay state, the same way any other
modal/drawer covers page content while open, not the passive "hovering"
bug being fixed here. The collapsed launcher never covers the composer at
any tested width.

## Verification

Verified with a temporary debug harness (`src/pages/__DebugKretoOverlap.tsx`,
mounted at `/__debug-kreto-overlap`, removed before commit) that rendered the
real `KretoLauncher` and `MessageComposer` components — both are
self-contained (no auth/context dependency) — inside the same wrapper
structure as the production page, so the measurement exercised actual
production CSS classes rather than an approximation.

Measured `getBoundingClientRect()` gap between the send button and
`KretoLauncher`, and horizontal/vertical intersection, at every desktop
width where `KretoLauncher` is visible (`lg:` = 1024px+):

| Viewport | Vertical gap | Overlap (X∩Y) |
|---|---|---|
| 1024×768 | 647px | none |
| 1280×800 | 679px | none |
| 1440×900 | 779px | none |

320/375/390/430/768px were not re-measured against `KretoLauncher` directly
since it is `hidden` below the `lg` breakpoint by design — confirmed via
source (`hidden lg:flex`) and confirmed `ThriveBar` (its mobile equivalent)
self-excludes on `/messages`, so there is no Kreto surface present in the
chat view at those widths to overlap with.

## Test coverage

| Scenario | Status |
|---|---|
| Empty composer, desktop, Kreto collapsed | Verified — no overlap |
| Composer visible at 1024 / 1280 / 1440px | Verified — measured, no overlap |
| Mobile widths (320–430px) | Verified via source — no Kreto surface renders in chat view |
| Kreto expanded panel | Not blocking — treated as intentional overlay, not the reported bug |
| Long / multiline message, attachment present, loading/disabled state, screen reader | Not independently re-tested — this fix only changes the *parent column's* bottom padding, does not touch composer internals, so these states are unaffected by the change |

## Status

**Implemented.** Locally verified via debug harness with real production
components. Not yet verified against a fully authenticated, real-data
Messages session (would require a logged-in test account) — the harness
substitutes stub props but is not a substitute for an end-to-end pass through
`/messages` with real conversation data.
