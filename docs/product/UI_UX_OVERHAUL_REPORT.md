# UI/UX corrective overhaul: report (2026-10-22)

Branch `feat/ui-ux-corrective-overhaul`, committed locally, **not pushed, not deployed, not published**. No migration, no database write, no backend or Edge Function change, no dependency added. Every change is a frontend file.

## Status by item

| # | Item | Status | What was done |
|---|------|--------|---------------|
| 1 | Passport as one component | **partial** | The bright hairline between the Holo card and "Passport intelligence" is gone; the overview now has the Holo card's `rounded-2xl` and one `mt-3` gap, so the two read as one surface. They are still two components (`PassportHero` in a `HoloCard`, then `PassportOverview`), not merged into one file: tilting the intelligence content with the card would have been worse. No duplicated Passport section was found in `Profile.tsx`. |
| 2 | Holo cards: stability and one effect | **done** (see audit) | Root cause of the corner tremble fixed in the shared `HoloCard`. Default tilt 8° to 5°, sheen 0.85 to 0.6 when active. |
| 3 | Scout | **done**, tabs by existing logic | "Scan now" is now the first thing on the Scout card, above the signal cards. The sentence "Free tier: 1 Scout preview per week..." is not in the code (already removed before this pass). Open Gigs is ordered by the existing `computeOpportunityMatch` (priority gigs first, nothing hidden, existing order when there is no profile signal, no new score shown). For You already lists gigs scouted and matched to the Passport; Shortlist is the person's own saved gigs, unchanged. |
| 4 | Studio top bar | **fixed by code reading, not reproduced** | The app scrolls inside its own `overflow-auto` container, which kept its scroll offset from the previous page, so the Studio opened scrolled and its header (switcher, call, invite) was out of view. `ThriveDesk` now returns that container to the top when a Studio opens. Needs a look in a signed-in session. |
| 5 | New Room header | **partial** | Eyebrow is now the Kretopia mark, "Kretopia" in the foreground colour and "Studio Room" muted. The client chip and date come first in the meta row, the mood and timer sit to the right. No separate "left-side bar" exists in the code: the cluster of chips (mood, "Link to client", date, timer) in `VibeHeader` is what could be read that way. "Link to client" and the date are kept. |
| 6 | Break into tasks | **done** | Root cause: the shared `Button` default variant is `.btn-glass`, which forces its label colour, and the call site painted the background with `--energy` (white in dark themes), so the label vanished. It now uses the shared primary button. |
| 7 | New Room as two components | **partial** | Removed the duplicates that were repeated verbatim: the first-stage "Your Next Move / Kick off the conversation / Open Chat / Write a brief instead" card (the Room chat button and the Brief section are on the same page) and the "Define the project scope" step. Every later stage keeps its next move. The Autopilot banner and the Room chat button are kept (each is the only entry point to its action). The two-section restructure of the draggable widget board was **not done**. |
| 8 | New Room design pass | **not done beyond 5 to 7** | No further visual work. |
| 9 | "Make your Passport yours" width | **done, measured** | The bar is now `TodayDeck`'s `lead`, so the deck places it. Flat and swipe modes: the page width, which equals the carousel. Roulette: centred at 55.2rem. Measured in a browser: the bar's edges match the left card's left edge and the right card's right edge within 0.2px at 1024, 1300 and 1600px; on a phone the bar equals the swipe row (24 to 351px). |
| 10 | Landing videos | **done, measured** | `autoplay` overrides `preload`, so all five large files started loading at once on a phone, below the fold included. Only the first chapter keeps the attribute now; the others fetch metadata, are promoted to full one screen before they are reached, and start when they come into view (the existing logic). The network log shows the follow-up downloads of the four lower videos aborted. No poster was added: `AGENTS.md` says chapter videos are served without posters (a still flashes and delays playback). No video was re-encoded. |
| 11 | Kreto CTAs | **done** | "Meet Kreto" (unchanged link) and "See how it works" (the shared `OutlineCtaButton`, the hero's secondary style) in equal grid tracks. It scrolls to Kreto's own walkthrough in the same section: no new page. |
| 12 | Partner With Us | **done** | The same `OutlineCta` the hero uses for its right-hand button, link unchanged, in an equal-track pair with "Hire Through Kretopia" (266 x 46px each at desktop, full width stacked on a phone). |

## Files
Created: `docs/product/UI_UX_OVERHAUL_REPORT.md`, `src/components/passport/__tests__/HoloCard.test.tsx`, `src/components/landing/kretopia/__tests__/ChapterVideo.test.tsx`.
Modified: `src/components/passport/HoloCard.tsx`, `PassportOverview.tsx`; `src/components/circle/OpportunitiesFeed.tsx`; `src/components/scout/ScoutWrapped.tsx`; `src/pages/ThriveDesk.tsx`; `src/components/project/studio/VibeHeader.tsx`, `BriefSection.tsx`, `StudioRoom.tsx`; `src/components/today/TodayDeck.tsx`, `TodayCommandCenter.tsx`; `src/components/landing/kretopia/MeetKretoSection.tsx`, `ForOrganisationsSection.tsx`, `ChapterSection.tsx`.

## Holo card audit
- 22 files import the shared `HoloCard` (31 mention it); no second implementation was found. Three files mention "holo" or "foil" without importing it (`TodayCommandCenter`, `CreatorWorkHome`, `EventPage`); they were not read in detail (TODO).
- Cause of the trembling near corners: the pointer was tracked on the tilted card itself. At a corner the tilt moved the card's own edge from under the pointer, which reset the tilt, which put the pointer back over the card, in a loop. It is now tracked on the wrapper, which never moves, and the position is clamped to the card.
- Effect is transform and opacity only; nothing sets width, height, top, left, margin or padding (tested). The foil stays visible at rest on every card, including touch and reduced motion, which stay flat.
- Callers keep their own amplitude (`maxTilt` 3 to 5, `glow={false}`); only the default moved.
- Not verified: the tremble itself, which needs a real pointer on a real card. The mechanism is covered by tests, and the test fails if the handlers go back on the tilted element.

## Removed duplicates
Only the first-stage next-move card (see item 7). `Room chat`, the Brief section and the Autopilot banner each remain the single entry point of their action.

## Preserved
Every Passport action and number, the Scout scan (permission-aware, cannot fire twice), every Studio header control (switcher, collaborators, video call, settings, invitations), "Break into tasks" behaviour, Today's three cards and their dismissal of the banner, all Landing links and tracking ids, the first chapter's autoplay and its preload.

## QA checklist
Run: `tsc -p tsconfig.app.json` exit 0; ESLint, same error count as `HEAD` on every touched file (0 on new files); 7 tests on HoloCard (a mutation putting the handlers back on the tilted element fails 2), 6 on chapter video loading (a mutation restoring `autoplay` everywhere fails 1); Today deck bar measured at 1024, 1300, 1600 and 375px; Landing pairs and video network measured on the real `/landing` at 1300 and 375px, dark theme; no horizontal overflow on the Landing at 1300 and 375px.
Not run: Passport unified view, Scout tabs and Scan now, Studio top bar, New Room structure and "Break into tasks" in a signed-in session (these pages need an account and live data); tablet width; light theme; console errors on the affected routes; full suite and build.
Tests failing on `HEAD` too, not caused by this work: `ProjectNotes.continuity` (7), `ChapterProgressNav` (1), `VoiceFirstCreateModal` "renders the prompt-mode heading..." (1).

## Known limitations and TODOs
1. Items 1, 5, 7, 8 are partial as described; a two-section New Room needs a decision on the draggable widget board first (it is user-customisable and persisted).
2. Item 4 is a cause found by reading the code; confirm in a signed-in session that the header is in view on arrival from a scrolled page.
3. In the preview pane, `IntersectionObserver` callbacks did not reach the chapter videos, so scroll-triggered playback is covered by tests, not observed live. Check on a phone that a lower chapter starts when scrolled to.
4. Open Gigs order now follows the person's skills, role and city. Confirm that is the order you want for the free preview (`DiscoveryGate` shows the first four).
5. Audit `TodayCommandCenter`, `CreatorWorkHome` and `EventPage` for their own holo-like effects.

## Rollback
Everything is one commit on `feat/ui-ux-corrective-overhaul`; `git revert` of it restores the previous behaviour. Per item: `HoloCard.tsx` (tilt tracking and amplitude), `PassportOverview.tsx` (hairline, radius, gap), `OpportunitiesFeed.tsx` (the `useMemo` ordering), `ScoutWrapped.tsx` (block order), `ThriveDesk.tsx` (the `useLayoutEffect`), `VibeHeader.tsx`, `BriefSection.tsx` (one className), `StudioRoom.tsx` (`DUPLICATED_NEXT_STEPS`), `TodayDeck.tsx` and `TodayCommandCenter.tsx` (the `lead` slot), `ChapterSection.tsx` (`autoPlay={index === "II"}`), the two Landing sections (CTA pairs).

## Publish-readiness decision required
Nothing has been published. To publish this branch: merge it, then publish the frontend; no Edge Function paste and no database step is involved. Decide first on (a) the Open Gigs order, (b) Partner With Us becoming the outline style, (c) whether partial items 1, 5, 7 and 8 are acceptable as they are or need the New Room board decision, and (d) a signed-in look at items 3, 4 and 6.
