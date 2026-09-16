# Deadline Day — Accessibility Report

## Status: `IMPLEMENTED`, `TYPECHECKED`, `BUILD_PASSED` for the new fix this round. Prior accessibility work from the Kreto Platform Acceleration program (avatar alt text, profile-page auth-gate fix) remains in place and is summarized here for a complete picture, not re-verified today since nothing touched it.

## New this round

**Icon-only delete button had no accessible name and was invisible to keyboard focus.** While implementing the P0 event-comment-moderation fix (`EVENT_COMMENTS_RELIABILITY_REPORT.md`), found `EventComments.tsx`'s delete button had two real gaps:
1. No `aria-label` — a screen reader had no accessible name for it at all.
2. `sm:opacity-0 sm:group-hover:opacity-100` with no `focus-visible` equivalent — on desktop, the button was only revealed on mouse hover, invisible to a keyboard user tabbing through the comment list. This directly violates this brief's own P0 rule: "no inaccessible hover-only actions."

Fixed both: added `aria-label="Delete comment"` and `sm:focus-visible:opacity-100` so keyboard focus reveals the button exactly as hover does. `SOURCE_CONFIRMED`, `TYPECHECKED`, `BUILD_PASSED`.

**`EventCommunityHub`'s new tab wrapping (`GLOBAL_UI_WRAP_POLISH_REPORT.md`) inherits full accessibility from `StudioSectionTabs`**, which is itself a thin wrapper over Radix UI's Tabs primitive — `role="tablist"`/`"tab"`/`"tabpanel"`, arrow-key navigation, and focus management all come from Radix, not reimplemented. This is the same primitive already in production use for `Recordings.tsx`/`StageGrid.tsx`. No new accessibility work was needed for the tabs themselves; verified by reading `StudioSectionTabs.tsx` directly (no ARIA overrides, no custom keyboard handling that could break the inherited behavior).

## Carried forward from the Kreto Platform Acceleration program (still valid, not re-touched)

- `FramedAvatar` (used by `ViewProfile.tsx`, `PassportHero.tsx`, `CircleBrowseGrid.tsx`) now always has a real `alt` — previously had none at all, which can cause some screen readers to announce a raw image URL instead of nothing.
- `ViewProfile.tsx` (`/profile/:userId`) redirects anonymous visitors to `/epk/:userId` instead of a bare "Profile not found" wall — an accessibility-adjacent reliability fix (a screen-reader user following a shared profile link previously got no meaningful content at all).
- `CircleBrowseGrid.tsx`'s avatar `alt` text respects the existing name-masking for unauthenticated viewers, so the fix doesn't leak an unmasked name to assistive tech that the visible UI deliberately hides.

## Not re-audited this round

A full accessibility sweep (heading hierarchy, 200% zoom, reduced-motion, dialog/drawer Escape-and-focus-return semantics) across every touched surface was not re-performed today — out of scope for a focused P0/P2 pass per this brief's own conservatism rule. The two concrete gaps found while directly reading the touched files were fixed; nothing else was assumed broken or working without evidence either way. `NOT_CONFIRMED` for anything not explicitly named above.

## Verification

- `npx tsc --noEmit -p tsconfig.app.json` — clean.
- `npm run build` — clean.
- `BROWSER_VERIFIED`: not possible for the delete-button fix specifically (requires a host/participant test account and a real event, neither available in this environment — see `DEADLINE_DAY_BROWSER_VERIFICATION.md`).
