# Feature Surface QA — Kretopia UX/UI Rearchitecture

Date: 2026-08-14 · Branch: `feature/activation-priority-plan` · Companion to `FEATURE_SURFACE_AUDIT.md`

This is the phase-by-phase delivery record for the rearchitecture charter. Each entry states what
shipped, what was verified live, and what's deferred — honestly, per the charter's own "do not claim
a feature is complete unless it was browser-tested" rule.

## Verification suite (final run)

```
npm run typecheck   → clean (tsc --noEmit, exit 0)
npm run build        → succeeds, 319 precache entries, 14.7s
npm run test          → 62/62 passing (5 files)
npm run lint (touched files only) → clean except pre-existing debt
                        confirmed out-of-range of every diff via
                        `git diff --unified=0 <file> | grep "^@@"`
console errors        → none, checked in fresh tabs (no stale-HMR
                        history) on: /, /credits, /post-opportunity
```

## Commits this charter

| Commit | Phase | Summary |
|---|---|---|
| `f096ee4d` | 0 | Full feature-surface audit — `FEATURE_SURFACE_AUDIT.md` |
| `cd94a2fc` | 2 | Remove "Understand the evidence" + "Ask Kreto" tutorial steps |
| `63a5866b` | 7 | Remove Sign In, restyle Get Started as the single guest CTA |
| `7a8a823e` | 8 | Fix invisible/unclipped "Creativity" on the Sign In page |
| `f8e24490` | 9 | Real logo asset in footer + eliminate 112px dead space |
| `4fe820a3` | 10 | Reduced-motion fallbacks for slide-up/confetti utilities |
| `3cd17126` | 11 | Fix guest nav overflow clipping the CTA at 768px |
| `36a741a7` | 6 | Remove 4 confirmed-dead Passport hero components |
| `e3e7ccc5` | 5 | Scout: hero slot for the top match + carousel instead of a grid |
| `cb463601` | 4 | Studio: milestone strip + call history as a carousel |
| `2f69ca5b` | 3 | Today: trim MorningPulse's duplicate overdue/money signal |

## Phase-by-phase

### Phase 0 — Audit
`FEATURE_SURFACE_AUDIT.md` documents current UX, cards, CTAs, tutorials, data sources, and animation
per feature (Navbar, landing tutorials, Auth, Today, Studio, Scout, Passport), with keep/merge/
convert/remove decisions. No card was removed without confirming its data/action is represented
elsewhere and no route depends on it.

### Phase 1 — Landing tutorials as full product sections
**Already satisfied**, no rebuild needed. `ChapterSection` + `FeatureTutorialPanel` + `TutorialStepper`
give every chapter a numbered kicker, title, benefit copy, large step-reactive visual, full click/
keyboard-navigable step roadmap, and a primary CTA — matching the Kreto benchmark's structure. Verified
live across the Search, Passport, Scout, Match, Studio, and SoundStages chapters in a prior session
pass; re-confirmed structurally sound during this charter's audit, not re-tested pixel-by-pixel since
nothing in this pattern changed.

### Phase 2 — Remove requested landing cards
Removed `VERIFIED_CREDITS_TUTORIAL[0]` ("Understand the evidence") and `KRETO_TUTORIAL[0]` ("Ask
Kreto"). Numbering is array-index-derived, so the remaining steps auto-renumbered to 01/02/03 with no
manual patching. **Browser-verified**: navigated to `#chapter-verified-credits` and `#chapter-kreto`,
confirmed step 01 is now the intended next step on both, no empty sections, no broken anchors, mobile
progress bar still absent (removed in a prior pass). Also fixed a latent bug the edit surfaced: the
Verified Credits evidence-demo's Stamp reveal was tied to a hardcoded step count that never matched the
tutorial's real length, so it never fired — now derives from the array's own length and **verified
live** that clicking the final step now correctly reveals the "Passport Stamp" badge.

### Phase 6 — Passport
The "one dominant surface + max 2 supporting blocks" structure **already existed** from a prior pass
(`PassportHero` is self-documented as the merge target; `KretoActionCenter`/`TrustOpportunityCenter` are
already "Block 1 of 2"/"Block 2 of 2" in `Profile.tsx`). This phase's actual work: removed 4
confirmed-dead files (`PassportClaimHero.tsx`, `PassportHeroRibbon.tsx`, `PassportOverview.tsx`,
`src/components/profile/ProfileHero.tsx`) — re-verified zero live imports via grep immediately before
deletion (only stale doc-comments referenced them), confirmed via clean typecheck/build after removal.
**Not done**: folding `PassportHero`'s static 2-item "strongest credits" grid into the `CreditsSection`
carousel — judgment call to skip, since a 2-item carousel has nothing to scroll and doesn't serve the
"reduce card count" goal in any real way; the grid stays as a compact in-hero teaser, `CreditsSection`
below remains the full browsing surface.

### Phase 5 — Scout
Re-read `ScoutedGigsSection.tsx` in full and confirmed the audit's honesty finding still holds:
`fit_score`/`fit_reason` come from a real LLM call grounded in the user's actual profile/preferences,
never fabricated. Since gigs are already ordered by `fit_score` desc, promoted `gigs[0]` to a dedicated
hero card above the fold — full (non-truncated) `fit_reason` text, Save/Dismiss inline, one primary
"View full brief" CTA — no new scoring logic, purely a hierarchy change over existing honest data. The
rest of the list converts from a 2-col grid to the exact embla carousel pattern already proven in
`CastingCallsRail` (`align:start`, `dragFree`, `duration:0` under reduced motion,
`CarouselPositionDots`). The compact "More from today" embed (`limit` prop) gets a carousel too, no
hero — that context already has its own framing. Extracted the card markup into a `renderGigCard()`
closure so hero/carousel share identical cards. Every existing action (save/dismiss/open/draft/apply/
outcome) is unchanged. **Not done**: Studio hand-off and "Apply with Passport" — both need an
application-to-project data model that doesn't exist yet; faking either with a state-less redirect
would violate "don't claim functionality the app doesn't have."

### Phase 4 — Studio
`CallHistorySection.tsx` was a vertical list with a manual "show all N" toggle — converted to the same
carousel pattern, removing the toggle state entirely (the carousel handles overflow naturally). Built
`MilestoneStrip.tsx`: milestones turned out to already be a fully-built concept (`MilestoneBoard.tsx`,
with escrow/status/role-aware views, reachable via the Studio tool switcher's existing "Finance" tab) —
just invisible from the default "Today" tab. The new strip is read-only (title/amount/status chips,
paid-count summary), doesn't duplicate `MilestoneBoard`'s management logic, and every chip links
straight to the real Finance tab. Wired into both the desktop widget board (new `"milestones"`
`WidgetId`) and the mobile side column, gated on the same `showMoney` permission `MoneySection` already
uses. **Not done**: file/deliverable-list carousel conversion, and a dedicated Approvals surface — the
latter still has no dedicated data model, confirmed during this pass, deferred rather than fabricated.

### Phase 3 — Today
Re-reading `TodayThreeCards.tsx`, `MorningPulse.tsx`, `ApprovalsHub.tsx`, and `MoneyBrief.tsx` in full
(rather than trusting the Phase 0 audit's summary) found the redundancy was narrower than first
assumed: `ApprovalsHub` is a real actionable surface (approve/send/dismiss AI-drafted outreach, not
shown compactly anywhere else), `MoneyBrief` shows "in this month" received-payment data `TodayThreeCards`
doesn't have at all, and `ScoutedGigsSection` is already the richer, carousel-converted opportunity
view (Phase 5). Deleting any of these outright would have been a real capability loss, not a
duplicate-card removal — so they were left in place. `MorningPulse` was the one confirmed case of true
duplication: its "Morning Brief" line and chip row repeated overdue-task count, due-today count, and
pending-invoice amount, all already shown by `TodayThreeCards`' Next Move and Money Signal cards higher
on the same page. Trimmed to the one signal that appears nowhere else on Today (unread-message count)
plus its Active Studios rail (also unique — no other Today section lists recent projects). Every
dropped chip's destination stays reachable via `TodayThreeCards` and the Navbar.

**This is a narrower, more conservative outcome than the original audit's "merge into TodayThreeCards"
framing** — implementing it required reading each component's actual data-fetching logic, and that
reading found less pure duplication than the summary suggested. Preserving real, working functionality
took priority over hitting a card-count target for its own sake.

### Phase 7 — Navbar
Removed the standalone "Sign In" entry from desktop inline nav and the mobile guest sheet (which
previously had no signup entry at all — now does). Restyled Get Started with `.cta-primary`: flat
`#FF2DA1` regardless of theme (confirmed `rgb(255,45,161)` in both forced-light and default-dark via
`getComputedStyle`), a restrained hover/focus glow, one slow light-sweep per 6s cycle. **Caught and
fixed during testing**: the button initially had no explicit `variant`, so Tailwind's default-variant
`bg-primary`/`hover:bg-primary/90` utilities were winning the cascade against the custom hover state,
flashing white on hover/focus — fixed by switching to `variant="link"` (zero background utilities to
conflict with). **Browser-verified**: desktop + mobile screenshots, hover/focus computed-style checks,
mobile hamburger menu opened via direct DOM `.click()` (the `computer` tool's synthetic click hung on
infra flakiness unrelated to the app — confirmed via `dialogCount` before/after) showing the sheet
correctly lists Home/Verified Credits/Spotlight/About Us/Hire Talent/**Get Started**, no Sign In.

### Phase 8 — Auth "Creativity" fix
Root cause was **not** the blur animation I suspected first — it was two invalid CSS declarations: (1)
`--kretopia-sunset` resolves to a flat color post-design-reset, but the span set it via `backgroundImage`
(invalid for a bare color, computed to `none`, so the `background-clip:text` span had no paint source
at all — confirmed via `getComputedStyle().backgroundImage === "none"`); (2) even after switching to the
`background` shorthand, Tailwind's `bg-clip-text` alone didn't clip the fill in this render context,
needing the explicit `-webkit-background-clip`/`-webkit-text-fill-color` pair the codebase's own
`.text-k-full` utility already uses elsewhere. **Browser-verified**: before/after screenshots at
1440×900 and 1440×1000 — "Creativity" now renders sharp, pink, italic, correctly clipped to the glyphs.

### Phase 9 — Footer
Swapped `EditorialFooter`'s hand-rolled serif-italic text wordmark for the real `<BrandLogo>` asset with
`showBeta`, matching Navbar sizing/style. Root-caused the reported "empty space below the footer": an
unconditional 112px-padded wrapper div in `UnifiedHome.tsx` (originally holding the full legacy guest
narrative, since retired) rendered for guests with nothing left inside it except `{user &&}`-gated
content. Gated the whole wrapper on `{user &&}` — **verified via `getBoundingClientRect`** the gap went
from 112px to 0px, and confirmed the authenticated-user render path is byte-identical (same children,
same conditional, just moved one level up).

### Phase 10 — Shared animation system
Audited all 11 `@keyframes` blocks in `index.css` against reduced-motion coverage. Found and fixed two
live-used, transform-driven utilities with no fallback (`.animate-slide-up`, `.animate-confetti`);
`.animate-fade-in` is opacity-only, exempted per standard guidance. Confirmed every animation this
charter touched already gates on `useReducedMotion` or a matching CSS media query, uses
`pointer-events: none` + `aria-hidden` on decorative layers, and that blur is static (only opacity
animates on top) — no continuous-blur cost. `.animate-glow`, `.animate-bounce-in`, and an orphaned
`gradient` keyframe are confirmed dead code (zero call sites) — left untouched.

### Phase 11 — Performance and responsiveness
Confirmed VideoCall's lazy-loading requirement is already satisfied: all 6 pages that import it
(`SpeedSession`, `CuratedStage`, `OpportunityDashboard`, `PersonalRoom`, `ViewProfile`,
`CircleChatView`, `GuestCall`) plus `Messages` (parent of `ChatHeader`, the 7th consumer) are
route-level `React.lazy()`. Tested the charter's required breakpoint set (375/390/430/768/1024/1280/
1440) on the surfaces this charter touched and **found a real overflow at 768px**: the guest inline nav
used `md:flex` (768px+) while the authenticated nav already used `lg:flex` (1024px+) for the equivalent
row — at 768px, logo + search icon + 3 nav links + Hire Talent + Get Started didn't fit, and
`getBoundingClientRect` confirmed Get Started was rendering ~84px past the viewport edge with no
scrollbar to reveal it. Fixed by moving the guest nav and its hamburger fallback to `lg:`/`lg:hidden`,
matching the authenticated breakpoint. **Verified**: zero horizontal overflow at 430/768/1024px
post-fix (`scrollWidth === clientWidth` at all three).

### Phase 12 — Accessibility
H1 hierarchy confirmed clean on both pages checked: landing has exactly one `motion.h1` (the hero
headline), all chapters correctly use h2; Auth has exactly one `<h1>` ("Welcome to Kretopia"), with
`AuthBrandingPanel`'s marketing copy correctly subordinated to h2 even though both render simultaneously
at desktop widths. Keyboard/focus-trap/Escape behavior relies on Radix Sheet/Dialog primitives, untouched
by this charter's edits. No hover-only functionality introduced. Icon-only buttons already carry
`aria-label`s. **One finding, not fixed**: white text on `#FF2DA1` measures 3.42:1 contrast — below
WCAG AA's 4.5:1 for normal text (passes the 3:1 large-text/UI-component threshold). This is a pervasive,
pre-existing brand-color pattern used in 11+ files across the app (Meet Kreto CTA, Explore Verified
Credits CTA, Passport Stamp badge, etc.), not something introduced by or scoped to this charter's work —
documented here rather than unilaterally changing the brand accent the charter itself mandated.

### Phase 13 — This document + `FINAL_UX_QA.md`
