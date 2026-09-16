# Messages — Black Bar Fix Report

## Root cause (confirmed, not just theorized)

`KretopiaBottomNav.tsx` is `fixed bottom-0`, near-black under this app's
hardcoded dark theme, `lg:hidden` (mobile only). `Messages.tsx`'s outer
flex row reserved a shared `pb-20 lg:pb-24` for *both* the Inbox and the
chat view — but that padding was a flat, non-safe-area-aware guess, and it
lived on the shared parent rather than on either panel's own root, so the
padding "gutter" itself was unstyled/transparent rather than matched to
either panel's real background.

Measured directly in the browser at a 375×812 mobile viewport (real
numbers, not estimated): the bottom nav's actual rendered height is
**71.5px** — more than the `pb-20`'s 80px would suggest is "safe," and
critically, my first fix attempt (a flat `4rem`/64px) still left the
Inbox's scrollable content **5.5px short** of clearing the nav. This is
exactly the class of bug the original code had, just smaller in magnitude.

## Fix

- `ConversationListPanel.tsx`'s own root now carries
  `pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0` — the Inbox reserves
  its own safe-area-aware clearance instead of relying on the shared outer
  padding, and because it's *inner* padding on an element that already has
  `bg-card`, there's no separate transparent gutter to show a seam through.
- `Messages.tsx`'s outer row dropped the shared mobile `pb-20` (kept
  `lg:pb-24`, which is protecting an unrelated desktop composer/
  KretoLauncher overlap fix from a prior commit — not touched).
- The 1:1 chat view (`Messages.tsx`) and the group chat view
  (`GroupChatPanel.tsx`) both upgraded their own `pb-20` to
  `pb-[calc(5rem+env(safe-area-inset-bottom))]` for the same reason —
  they had the identical non-safe-area-aware padding pattern, just not the
  one originally reported.

## Verified

- **Live, numerically, at 375×812 (mobile)**: measured the actual gap
  between the Inbox's scrollable content and the bottom nav's top edge via
  `getBoundingClientRect()` — before the fix, content could extend under
  the nav; after settling on `5rem`, there's a confirmed **10.5px**
  clearance in a zero-safe-area test environment (real notch devices get
  more, via the `env()` term).
- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
  `npx eslint` on all three touched files — clean.

## Not independently verified

The chat/composer view's mobile clearance specifically — this session's
test account has an empty inbox ("No messages yet"), so no real
conversation could be opened to visually confirm the composer view. The
fix applied there is mechanically identical to the Inbox fix (same
`pb-[calc(5rem+env(safe-area-inset-bottom))]` pattern, verified working on
the Inbox), so it's implemented with the same confidence but not
independently re-measured. Desktop, tablet, and other breakpoints beyond
375×812 were not re-tested this pass.
