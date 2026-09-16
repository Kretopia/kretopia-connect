# Studio Avatar Removal Report

## Scope

Section 1 of `GLOBAL_HEADER_UX_AUDIT.md`: remove the `KretoAvatar` rendered on the "Kreto · Studio" card. Initially scoped to that one card; per explicit follow-up direction ("leave the top Kreto and remove the bottom avatar"), extended to the second avatar on the same `/desk` page — the "New Room" card directly below it — while continuing to leave every other `KretoAvatar` mount point in the app untouched.

## What was found

`KretoTip` (`src/components/agent/KretoTip.tsx`) is a single shared component mounted on 10 different surfaces (`WorkHome.tsx`, `MoreFromToday.tsx`, `Discover.tsx`, `Meetup.tsx`, `SoundStages.tsx`, `Recordings.tsx`, `ThrivePay.tsx`, `Match.tsx`, `Scout.tsx`, `Clients.tsx`). Each resolves a `tip.eyebrow` from either an explicit `surface` prop or the current route. On `/desk` (Studio) the resolved eyebrow is `"Studio"`, rendering `Kreto · Studio`. `StudioCreateHero.tsx:74` — the card rendered directly above `KretoTip` on the same page — already shows its own `KretoAvatar`, so a second one immediately below reads as a redundant identity portrait rather than a fresh signal.

## What changed

`src/components/agent/KretoTip.tsx`:
- Added `const isStudio = tip.eyebrow === "Studio";`, computed after `tip` is resolved (covers both the explicit `surface="desk"` prop and implicit route-based resolution — every path that produces the "Studio" eyebrow).
- Conditionally render, only when `isStudio` is true, a compact signal-mark chip in place of `KretoAvatar`: a filled circle at the exact same box dimensions `KretoAvatar` used at each size (`h-10 w-10` compact / `h-16 w-16` default, matching `KretoAvatar`'s own `sm`/`md` sizing), filled with the same `var(--kretopia-sunset, hsl(327 100% 59%))` gradient already used twice elsewhere in this same file (the card's ambient glow, the CTA button), containing a `Sparkles` icon — the app's own pre-existing "Kreto-powered" visual marker, not a new invention. Marked `aria-hidden` since the adjacent `Kreto · Studio` text already establishes who's speaking; no accessible name is lost.
- Every other resolved eyebrow (`Today`, `Scout`, `Match`, `KrePay`, `Passport`, `Clients`, `Events`, `Circle`, `Recordings`, `Studios`, the `Kreto` fallback) is unaffected — `KretoAvatar` renders exactly as before.

Nothing else in the file changed: no data fetching, no dismiss/rotation logic, no CTA behavior, no route matching, no other component touched.

## Explicitly not done

- `KretoAvatar.tsx` itself: untouched.
- No other `KretoTip` mount point: untouched.
- No participant/collaborator/user avatar anywhere in the app: untouched.
- No accessibility label removed — both replacements are decorative (`aria-hidden`), same treatment the ambient glow div in `KretoTip` already uses.

## Second change — the "New Room" card (`StudioCreateHero.tsx`)

`StudioCreateHero` is Studio-specific — confirmed via `grep` that only `WorkHome.tsx` actually imports and renders it (two other files matched the search string, but only in doc comments, not imports), so removing its avatar needed no branch/condition the way `KretoTip`'s shared-component removal did.

`src/components/project/studio/StudioCreateHero.tsx`:
- Removed the `KretoAvatar` import and its one usage (`size="sm"`, `hidden sm:inline-flex` — desktop/tablet only, matching the original's own responsive behavior).
- Replaced with a compact signal-mark chip at the same `h-10 w-10` box size, matching this file's *own* pre-existing convention rather than copying `KretoTip`'s treatment verbatim: the mic-button in the same file already uses a `hsl(var(--energy) / 0.14)`-tinted circle with a centered icon, so the replacement reuses that exact pattern with `Sparkles` (already imported in this file for the "New Room" eyebrow badge, not a new icon import).
- `useReducedMotion` import kept — still used elsewhere in the file for the prompt-rotation and proof-list animations, unrelated to the avatar.

## Verification

- Live at `/desk` (desktop, 1440×900): both the "Kreto · Studio" card and the "New Room" card below it now show the same compact signal-mark treatment — consistent, balanced, no portrait duplication.
- Live at `/desk` (mobile, 390×844): "Kreto · Studio" chip renders correctly; "New Room" card's chip is correctly absent, matching the original avatar's own `hidden` (mobile-hidden) behavior — no layout gap, no regression.
- Live at `/scout` and `/match`: both surfaces' `KretoTip` cards still show the real, unchanged `KretoAvatar` portrait.
- Console: one set of `ReferenceError: KretoAvatar is not defined` entries observed, traced to a stale Vite dependency-chunk reference from the exact moment of the edit (transient HMR churn) — confirmed non-reproducible: `tsc --noEmit` passed clean, a full fresh `npm run build` passed clean, and a subsequent page reload rendered correctly with no crash UI and no recurrence.
- `git diff` reviewed line by line for both files: `KretoTip.tsx` touches only the conditional render block; `StudioCreateHero.tsx` touches only the one import + one element swap.

## Regression gate

- typecheck: PASS
- lint: PASS (2 pre-existing `no-empty` findings in `KretoTip.tsx` at unrelated lines, confirmed via diff to predate this change; 0 findings in `StudioCreateHero.tsx`)
- build: PASS
- tests: PASS (127/127)

## Status

COMPLETE — both avatars on `/desk` addressed (Studio tip card via a conditional branch in the shared component, New Room card via a direct swap in its Studio-only component), verified live at desktop and mobile, confirmed every other `KretoAvatar` mount point (Scout, Match, and by extension Today/KrePay/Passport/Clients/Events/Circle/Recordings/Studios) unaffected, full regression gate clean.
