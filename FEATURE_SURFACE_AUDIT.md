# Feature Surface Audit — Kretopia UX/UI Rearchitecture

Date: 2026-08-14 · Branch: `feature/activation-priority-plan` · Author: Claude (autonomous audit pass)

## Baseline (Phase 0)

```
git branch --show-current   → feature/activation-priority-plan
git log --oneline -1        → d1254b3d feat(landing): enrich feature tutorial visuals with fuller per-step content
git diff --stat              → supabase/functions/mcp/index.ts (pre-existing, unrelated, untouched)
npm run typecheck            → clean
npm run build                → succeeds (318 precache entries; pre-existing >500kB chunk warnings on
                                ThriveDesk/Discover/index bundles — not introduced by this charter)
npm run test                 → 62/62 passing (5 files)
npm run lint (repo-wide)     → 3167 problems, almost entirely `@typescript-eslint/no-explicit-any` in
                                supabase/functions/** (edge functions) — pre-existing backend debt,
                                out of scope (charter forbids touching backend/migrations/secrets).
npm run lint (src/ only)     → 2444 problems, same pattern (`any` casts scattered across pre-existing
                                pages/hooks, e.g. ProfileVerificationSection.tsx). Not introduced by
                                this charter. QA gate for this work = no *new* lint errors in touched
                                files, verified per-phase with `npx eslint <changed files>`.
```

No regressions found in the baseline. All work below builds on a clean foundation.

---

## Landing page tutorials (`src/components/landing/kretopia/`)

**Current state is already strong.** A prior session pass (tasks #123–#131, #145) already built the
"Kreto benchmark" pattern and applied it broadly:

- `ChapterSection.tsx` + `FeatureTutorialPanel.tsx` + `TutorialStepper.tsx` give every chapter
  (Search, Passport, Scout, Match, Studio, SoundStages): numbered kicker, serif title, benefit body,
  large step-reactive visual (`featureVisuals.tsx`, enriched last session with real mock data per
  step), a full click/keyboard-navigable step roadmap (`TutorialStepper` supports arrow-key nav,
  click-to-jump, `aria-expanded`/`aria-controls`, a visible "Next: …" line, and an active-step
  orbit-ring), and a primary "Enter {Feature}" CTA.
- `MeetKretoSection.tsx` (Kreto) and `VerifiedCreditsChapterSection.tsx` go one step further with a
  live "command surface" mockup (rotating AI message / evidence-state progression) — these two are
  the actual reference benchmark the charter points at.

**Gap vs. the 9-part structure:** points 1–6, 8, 9 are already satisfied on every chapter. Point 7
("AI-guided contextual insight") is only literally present as a rotating-message command surface on
Kreto + Verified Credits; the other 5 chapters express it through their step-reactive visual content
instead (e.g. Scout's "Matches because: Event Production / Bali-based / Team lead" tags, Match's
"Narrowing to 6 real fits — not a cold list" line) — functionally equivalent, different presentation.
**Decision: keep as-is.** No badge-only tutorial exists; nothing here needs a rebuild.

### Cards flagged for removal (Phase 2)

| Card | File | Reason |
|---|---|---|
| "01 Understand the evidence" | `tutorialContent.ts` → `VERIFIED_CREDITS_TUTORIAL[0]` | Explicitly requested removal. Its content (evidence-tier explanation) is already fully covered by the "Why it matters" list in the same chapter's copy column (`WHY_IT_MATTERS` in `VerifiedCreditsChapterSection.tsx`), so no information is lost. |
| "01 Ask Kreto" | `tutorialContent.ts` → `KRETO_TUTORIAL[0]` | Explicitly requested removal. Its content ("ask in plain language") is already covered by the chapter's "Try asking" prompt chips in the command-surface mockup. |

Numbering is array-index-derived (`TutorialStepper` renders `String(i+1).padStart(2,'0')`), so deleting
index 0 auto-renumbers the remaining steps to 01/02/03 with zero extra code changes. The
`VerifiedCreditsChapterSection` evidence-demo mapping (`DEMO_SEQUENCE`/`isStamped`) is currently
hardcoded against a 4-step assumption and needs re-deriving from the new 3-step length in the same
edit (see Phase 2 plan below) — this is a pre-existing latent bug independent of the removal
(`isStamped` requires `activeStep === 4`, but `activeStep` only ever reaches 3 today, so the Stamp
reveal never actually fires at present).

### Landing footer (Phase 9)

The landing page renders `EditorialFooter.tsx` (not the generic `Footer.tsx`, which is unused by the
landing route). Findings:
- It hand-rolls a serif-italic text wordmark ("kretopia.") instead of the real `BrandLogo` component/
  asset used by the Navbar (`kMarkAsset`/`wordmarkAsset` PNGs) — this is the "wrong logo" the charter
  flags. Fix: swap in `<BrandLogo lockup showBeta />` on the left, matching Navbar sizing/style.
- "The other logo" in the charter refers to the "Thrive Collective" parent-brand line, currently
  rendered as plain text (`{BRAND.parentLine}`) — there is no separate Thrive Collective image asset
  in the repo, so it stays as styled text to the right of the real Kretopia logo, not literally two
  logo images.
- No obvious extra bottom margin in `EditorialFooter.tsx` itself (`pb-6 sm:pb-8` is deliberate, modest
  padding) — the previously-reported "empty space" bug (fixed in commit `f04182af`, task #135) may
  have regressed via a wrapper; needs live viewport verification at the very bottom of `/`.

**Decision: convert** (logo swap) + **verify** (bottom-spacing regression check).

---

## Navbar (`src/components/Navbar.tsx`)

- Guest state renders **both** a "Sign In" ghost button (line 528-540) and a "Get Started" gradient
  button (line 541-546), plus "Sign In" again inside the mobile guest sheet (line 503-510).
- `Get Started` currently uses shadcn `variant="gradient"` with no restrained-glow/shimmer treatment
  and no dedicated hover/focus/press states beyond the base button component.
- Auth route (`/auth`) itself is untouched by removing the Sign In *button* — `/auth` already reads a
  `?tab=signup` query param to default to the signup tab, so "Get Started" alone is a complete
  authentication entry point; sign-in still works by switching tabs inside `/auth`.

**Decision:** remove the standalone "Sign In" link (desktop inline + mobile guest sheet), keep "Get
Started" as the single guest CTA, restyle it per the charter's restrained-glow spec. Confirm no other
route or protected-route redirect depends on a literal `/auth` (non-signup) entry point existing as a
*visible nav link* — protected routes redirect to `/auth` directly via `ProtectedRoute`, not via this
button, so removing the button cannot break that mechanism.

---

## Auth page — "Creativity" blur (Phase 8)

**Root cause confirmed.** `AuthBrandingPanel.tsx` line 35-40:
```tsx
<span className="italic bg-clip-text text-transparent pink-glow-breathe" style={{ backgroundImage: ... }}>
  Creativity
</span>
```
`pink-glow-breathe` (`src/index.css` line 909-921) animates `filter: brightness(1 → 1.12)` alongside a
`text-shadow`. Applying an animated `filter` to an element that also uses `background-clip: text` +
`color: transparent` forces the browser to rasterize/composite the gradient-clipped glyphs through the
filter on every frame — this is the one and only place in the codebase where `pink-glow-breathe` is
combined with `bg-clip-text` (confirmed via repo-wide grep), which is exactly why only this one word
blurs while every other `pink-glow-breathe` usage (plain colored text, no `bg-clip-text`) renders sharp.

**Decision:** remove `pink-glow-breathe` from this specific gradient-clipped span (the gradient itself
already reads as the pink/white brand treatment without needing the breathing-glow filter on top).
Lowest-risk fix — one class removal, no structural change, no other `pink-glow-breathe` usage touched.

---

## Today (`src/components/home/UnifiedHome.tsx` — the actual `/` authenticated landing view)

Correction to my own assumption: `WorkHome.tsx` (`/desk`) is the Studios list, not "Today."
`UnifiedHome.tsx` is what a signed-in user actually lands on at `/`.

**Current stack (in order, all real Supabase/edge-function data, no mocks found):**

| Section | File | Real data | Notes |
|---|---|---|---|
| Prompt hero | `ThrivePromptHero.tsx` | intent-routing edge fn | Closest thing to a single primary CTA today |
| 3-card summary | `TodayThreeCards.tsx` | `agent_proposals`, `project_tasks`, `scouted_gigs`, `invoices` | Self-documented "Today = Home, ≤3 cards" precedent — **this is the right shape to keep/expand as the compact command-center core** |
| `KretoTip` | static route-keyed copy | not Supabase-backed, harmless | keep |
| `UpcomingSessionsCard`, `SpeedTonightCard`, `CuratedStagesRail`, "People for you" rail | various | all real, self-hiding when empty | keep, condense into one activity/opportunity carousel |
| `DailyBriefingCard` | AI edge fn | real | keep |
| `SurfaceProactiveCards`, `GetStartedChecklist` | real | keep |
| `<details>` "More from today": `MorningPulse`, `ApprovalsHub`, `ScoutedGigsSection`, `MoneyBrief`, `TrendingLane` | real | **redundant** — see below |

**Redundant cards (same signal, shown 2-3x on one page):**
- Next-action / approvals: `TodayThreeCards`'s "Next Move" card **duplicates** `MorningPulse` and
  `ApprovalsHub` (all three read overlapping `agent_proposals`/`project_tasks` signals).
- Opportunity: `TodayThreeCards`'s "Opportunity" card **duplicates** `ScoutedGigsSection` (same
  `scouted_gigs` table, same top-`fit_score` concept).
- Money: `TodayThreeCards`'s "Money Signal" **duplicates** both `MorningPulse` and `MoneyBrief` (all
  three read `invoices`).

**Decision:** keep `ThrivePromptHero` (primary command surface) + `TodayThreeCards` (next-action
summary, already the right density) as the first-viewport core. Merge `MorningPulse` and
`ApprovalsHub`'s unique-not-yet-in-`TodayThreeCards` signal (if any) into `TodayThreeCards` and remove
them as separate cards; convert `ScoutedGigsSection`'s and `MoneyBrief`'s "More from today" appearance
here into a single condensed activity/opportunity carousel entry rather than two more full sections.
No route or capability is lost — every underlying table/action stays reachable from its owning page
(Scout, ThrivePay) even after trimming its *duplicate* Today-page rendering.

---

## Studio (`src/components/project/studio/StudioRoom.tsx` — the real in-project Studio shell)

Correction: `StudioCardsGrid.tsx` is the outer *Studios list* (used on `WorkHome.tsx`), not part of a
single Studio's control room — out of this phase's scope, left untouched.

`StudioRoom.tsx` is a 2-column drag-reorderable widget board (desktop) / single column (mobile),
composing ~15 real, Supabase-backed sub-sections by `workspace_type`. No carousel usage anywhere under
`src/components/project/` today — `embla-carousel` exists only in the generic shadcn primitive, unused
here.

**Concept → owner map:**

| Concept | Owner | Status |
|---|---|---|
| Collaborators | `PeopleSection.tsx` | real, keep |
| Deliverables | `DeliverablesSection.tsx` | real, keep |
| Files | `BriefSection.tsx` + `project_files` | real, keep |
| Calls | `CallHistorySection.tsx` | real, thin list — candidate for carousel |
| Budget/payment | `MoneySection.tsx` (invoices) + `RequestPaymentCard.tsx` (milestones) | real, split across two views |
| Production activity | `StudioBrainPanel.tsx` (facts/entities, real) | keep — genuine AI-knowledge surface |
| Milestones | only surfaced inside `RequestPaymentCard` | **effectively missing as a first-class concept** — build a light milestone strip |
| Approvals | scattered mentions across type sections, no dedicated component | **effectively missing** — defer to a follow-up pass rather than inventing a fake approvals UI this round |
| Dead code | `StudioPulseFeed.tsx` (~304 lines, retired per its own in-code comment, zero live imports, still queries `studio_pulse_posts`) | flagged for removal — genuinely unused, not risky to delete, but out of this charter's explicit ask; noted for a follow-up cleanup task rather than bundled into this UX pass |

**Decision:** convert `CallHistorySection` and the per-workspace-type file/deliverable lists to
carousels using the existing `CastingCallsRail`-style embla pattern; add a compact milestone strip
sourced from the same `milestones` table `RequestPaymentCard` already reads (no new backend). Keep all
primary actions (create/edit/complete/approve/pay) exactly where they are today — one click into their
existing dialogs — per the charter's explicit "primary actions must remain visible" rule. Defer a full
Approvals surface (no real dedicated data model exists yet) rather than fabricate one.

---

## Scout (`src/pages/Scout.tsx` + `ScoutedGigsSection.tsx`)

**Match reasoning is real, not fabricated** — `fit_score`/`fit_reason` come from the `scout-gigs` edge
function, which sends the user's real profile (role, skills, location, bio, preferences) to an LLM and
asks it to score/explain against that real context. This is grounded, not random, though it is a
narrative LLM score rather than the deterministic, field-auditable `computeOpportunityMatch()` used by
the separate opportunity marketplace (`GigCard`/`GigRailCard`, which explicitly hides its score rather
than fabricate one when there's no signal). **Both systems are honest; neither invents a score.**

**Current state:** a plain 2-column grid, all cards equal weight, ordered by `fit_score` desc. No hero
treatment for the top match. No tutorial beyond a one-time dismissible hint. No Studio handoff after
"applied." No "Apply with Passport" — apply is always an outbound link/email.

**Decision:**
- **Convert** the grid to a carousel using the exact `CastingCallsRail` embla pattern already proven
  in this codebase (`Carousel`/`CarouselContent`/`CarouselItem`/`CarouselPositionDots`).
- **Build** a hero slot for the single top-`fit_score` opportunity above the carousel, showing its real
  `fit_reason` text and the real evidence it's grounded in (role/skill/location fields already on the
  row) — no new scoring logic, just better hierarchy over existing honest data.
- **Keep** every existing action (save/dismiss/open/draft/apply/outcome) exactly as wired.
- **Defer** a literal Studio hand-off and "Apply with Passport" flow — building this correctly needs an
  application-to-project data model that doesn't exist yet; documented as deferred work rather than
  faked with a redirect that doesn't actually carry state.

---

## Passport (`src/pages/Profile.tsx` + `src/components/passport/*`)

**This phase is largely already done by a prior session pass**, confirmed via the in-code comments
themselves: `PassportHero.tsx` (339 ln) is explicitly documented as "the ONE dominant Passport
surface... replaces the old ProfileHero + PassportClaimHero pair," and `Profile.tsx` already labels its
two supporting blocks "Block 1 of 2" (`KretoActionCenter` → `PassportCommandCenter`) and "Block 2 of 2"
(`TrustOpportunityCenter` → `PassportMomentum`) — i.e. the "one dominant surface + max 2 supporting
blocks" structure the charter asks for already exists.

`CreditsSection.tsx`/`CoSignsSection.tsx` (mounted below, in `ProfileContentSections.tsx`) already use
the shadcn `Carousel`/embla pattern with `CarouselPositionDots` — the carousel infrastructure the
charter asks for is already live, not something to build. `DiscoveriesInbox.tsx` /
`PendingDiscoveriesDialog.tsx` already implement the real "Not Me" / confirm-AI-content flow.
`KretoPassportBuilder.tsx` already gates AI-drafted bio/skills behind explicit user confirmation before
anything publishes.

**Confirmed dead code** (zero live imports anywhere in the repo, verified by grep):
`PassportClaimHero.tsx`, `PassportHeroRibbon.tsx`, `PassportOverview.tsx`,
`src/components/profile/ProfileHero.tsx`.

**Decision:** the structural work this charter asks for is already shipped. Remaining scope:
(1) fold `PassportHero`'s static 2-item "strongest credits" grid into the existing `CreditsSection`
carousel pattern instead of a separate static grid, for one consistent credits-browsing surface;
(2) remove the 4 confirmed-dead files (safe deletion — verified zero imports, no route depends on
them, no capability lost, matches the charter's own removal-safety checklist);
(3) no AI-editability gap to close — it's already enforced.

---

## Cross-cutting notes for later phases

- **Animation utilities already exist and are reusable:** `ai-ambient-breathe`, `ai-scan-line`,
  `ai-orbit-ring`, `pink-glow-breathe` (all reduced-motion-safe, defined once in `src/index.css`).
  Currently used only on landing/auth surfaces — Today/Studio/Scout/Passport carousels and command
  surfaces should adopt the same classes rather than inventing new motion, per the charter's "shared
  animation system" phase.
- **Carousel pattern already proven three times** (`CastingCallsRail`, `CreditsSection`,
  `CoSignsSection`) — every carousel built in this charter should copy that exact
  `opts={{align:"start", dragFree:true}}` + `CarouselPositionDots` + `useReducedMotion` shape for
  consistency, not introduce a fourth pattern.
- **No fabricated real-time/match/payment state found anywhere** in the surfaces audited — the
  codebase's existing discipline (hide-if-no-signal rather than fake a number) should be preserved in
  every new surface built this charter.
