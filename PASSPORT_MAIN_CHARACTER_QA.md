# Passport as Main Character — QA

**Route:** `/profile` (individual/creator branch of `Profile.tsx`)
**Commits:** `db6b1769` (Phase 1), `16cfe8c7` (Phase 6, HoloCard offscreen-pause), `18f3f206` (Phase 8, duplicate H1 fix)

## What changed

1. **`FeaturePageHeader`** (`src/components/features/FeaturePageHeader.tsx`) gained a new opt-in `centered?: boolean` prop (default `false`, so every other route using this shared header is unaffected). When `true`: the header switches to a centered flex-column layout, the title gets a `max-w-3xl` cap, and the subtitle gets `mx-auto`. Passport is the only current consumer.
2. **`Profile.tsx`**: the Passport header call now passes `centered`, and the title's hard `<br/>` was replaced with a natural wrapping span (`Passport. <span>Your work, verified.</span>`) so the "one-line-when-possible" requirement isn't fighting a forced line break.
3. **`PassportHero.tsx`** Share button restyled: pink solid fill (`bg-[hsl(var(--signal-teal))] text-black`) → neutral dark Liquid Glass outline button (`glass-surface`, white text, subtle border, `#FF2DA1` only on hover/focus/active), labeled "Share Passport" with a `Share2` icon. The modal it opens (`PassportShareSheet`) was already correct from a prior charter and was not touched.
4. **Phase 8**: `PassportHero.tsx` was independently rendering the user's display name as a second `<h1>`, while `FeaturePageHeader` already renders the page's title as the H1. Changed the display-name heading to `<h2>` — one H1 per page.
5. **Phase 6**: `HoloCard.tsx`'s two continuous decorative animations (ambient glow, scan-line) now pause via `IntersectionObserver` when the card scrolls offscreen, instead of animating indefinitely.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Centered, one-line-when-possible title, no clipping/awkward wrap on mobile | ✅ Live-verified: 2 clean centered lines at 375px, 1 line by 768px, no clipping at any tested width (375/768/1440) |
| One dominant Passport surface (identity/roles/location/bio/credits/stamps/skills/co-signs/evidence/availability/hiring CTA/Passport Strength/next action) | ✅ Confirmed via `PassportHero` + `HoloCard` + `KretoActionCenter` + `TrustOpportunityCenter` — all pre-existing from a prior charter, verified still intact and not duplicated |
| No competing hero blocks, no repeated stats/Share actions | ✅ Confirmed via Phase 0 audit — one Share button, one Passport Strength meter |
| One dominant 3D card + compact supporting sections + interactive carousels | ✅ `HoloCard` is the one dominant card; `ProfileContentSections` supplies compact, distinct supporting sections (not a duplicate grid) |
| Every AI field editable/removable/labeled/confirmed | ✅ Pre-existing `KretoActionCenter` disclaimers, not modified or regressed this charter |
| Share Passport CTA: neutral, "Share Passport" label, dark Liquid Glass, white text, `#FF2DA1` only on hover/focus/active, small icon, no loud pink fill | ✅ Implemented exactly as specified, live-verified visually (screenshot) at rest — neutral dark surface, white text |
| Modal stays centered/responsive/keyboard-accessible/Escape-closable/overlay-closable/mobile-friendly | ✅ `PassportShareSheet` is Radix-`Dialog`-based (confirmed via Phase 8 audit), so focus-trap/Escape/aria are handled automatically; live-verified opens centered and closes on Escape |
| WhatsApp/LinkedIn/X/Instagram/Email/Copy/QR-compatible | ✅ Confirmed live — all present in the share-target icon row for each of EPK/Rate card/Passport profile |
| Never claim a share succeeded unless actually initiated | ✅ No change to the underlying share-link generation logic |
| One H1 per page | ✅ Fixed in Phase 8, live-verified via `document.querySelectorAll('h1')` returning exactly 1 element |
| Decorative card animations pause offscreen | ✅ Fixed in Phase 6, live-verified via `animationPlayState` toggling `running`/`paused` on scroll |
| No horizontal overflow at 375/768/1440px | ✅ Verified |

## Live verification

Screenshots at 375px (2-line centered title, 3D card, Share Passport button, "Add 3 more verified credits" nudge), 768px (title collapses to 1 line), and 1440px (content stays centered/focused rather than stretching wide). Share modal opened via direct click, confirmed centered layout with three share sections (EPK/Rate card/Passport profile) each with a full platform icon row, closed via Escape. HoloCard's `animationPlayState` confirmed `"running"` in view and `"paused"` after scrolling fully offscreen.

`npx tsc --noEmit`, `eslint` diff-check (zero new issues across all three Passport-touching phases), `npm run build`, and `npm run test -- --run` (62/62) all pass.
