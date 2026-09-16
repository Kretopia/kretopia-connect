# Passport + Studio Rearchitecture — Before-State Audit

Baseline: `tsc --noEmit` clean, `npm run build` succeeds, `eslint .` at the established pre-existing baseline (3188 errors / 310 warnings — accepted debt, not chased, unchanged from prior phases this session). No `typecheck` or test script exists in `package.json` (`dev`, `build`, `build:dev`, `lint`, `preview` only) — `npx tsc --noEmit -p tsconfig.app.json` is used as the typecheck equivalent throughout this branch's history, and there is no unit-test suite to run.

## 1. Current component tree — Passport (`/profile`, `src/pages/Profile.tsx`)

Non-company render order (company accounts get a fully separate tree via `CompanyProfileView`, out of scope here):

1. `ClaimedProfileGlow` — ambient FX overlay
2. Inline "Passport" eyebrow header
3. Inline reveal banner (conditional)
4. `PassportKretoEntry`
5. `ClaimContinueBanner`
6. `DiscoveriesInbox` (conditional)
7. **`ProfileHero`** — image, name, **bio**, stats — hero #1
8. **`PassportClaimHero`** (wraps `HoloCard`) — the 3D Passport ID card — hero #2
9. `LevelUpCard`
10. `PassportMomentum`
11. `ThriveRemembersChip`
12. `RecentlyWorkedWith` (conditional)
13. `PassportCommandCenter`
14. Inline "Preview public Passport" / "Private dashboard" links
15. `ProfileContentSections` — tabbed container: Stamps / Book Me / Skills / Co-signs
16. `KretoPassportBuilder` (modal)
17. `ProfileDialogs` (dialog bundle — includes `PassportShareSheet`)
18. `EPKPdfEditor` (modal)

**The "two competing hero sections" problem, confirmed exactly:** `ProfileHero` (item 7, has image/name/bio/stats) and `PassportClaimHero` (item 8, the 3D `HoloCard`-wrapped ID card) are two separate, sequential full-width blocks. Bio lives only in `ProfileHero`; the 3D card does not render it at all. This is Phase 1's primary target.

**Confirmed dead/orphaned (leave on disk, do not delete):** `PassportOverview.tsx` — not mounted anywhere, already known and already unmounted from a prior phase. `PassportShareSheet` is imported in `Profile.tsx` but only actually used inside `ProfileDialogs.tsx` — not literally dead, just redundantly imported.

## 2. The 3D Passport component — `HoloCard.tsx`

Already exists, already good: pure CSS (`perspective`/`rotateX`/`rotateY`, no 3D library dependency), pointer-tracked tilt + foil glare, disabled via `prefers-reduced-motion` check AND `(hover: hover) and (pointer: fine)` check (so touch devices never get tilt) — `src/components/passport/HoloCard.tsx:22-26`. This already satisfies the charter's "subtle, performant, reduced-motion-safe, touch-stable" requirements as a shell. **Reused, not rebuilt, in Phase 1.**

Already mounted in three places: `PassportClaimHero` (the Passport ID card), `AchievementCard` (every Stamp/credit card), `CreditVerificationPanel` (every endorsement card). Confirms "Co-Sign Holo 3D cards" from an earlier phase are real and live.

## 3. Bio

Lives in `ProfileHero.tsx:357-362` only, rendered as a plain paragraph, separate from and before the 3D `HoloCard`. Not integrated. **Phase 1 moves it inside the unified card.**

## 4. Stamps

Two separate, inconsistent implementations:
- `CreditsSection.tsx` (Passport's "Stamps" tab) — grid of `AchievementCard`s, HoloCard-wrapped, evidence-gated labeling already correct (`"Verified"` only when `verification_status === "verified"`; otherwise `"Vouched · N"`, `"Publicly Sourced"`, `"Pending"`, or `"Self-claimed"` — **no mislabeling found**).
- `UnifiedWorkHistory.tsx` (`/credits/mine`, a separate route) — grouped vertical list, not HoloCard-wrapped, also evidence-gated correctly.

Terminology is already correct everywhere (Verified Credit vs. Stamp distinction respected). Phase 3's Stamps work is a layout/carousel modernization of `CreditsSection.tsx`, not a terminology fix.

## 5. Book Me

Not a single component — the "Book Me" tab mounts five components together: `HireMeTrustBar`, `AvailabilityCalendarSection`, `BookingWindowsCard`, `RateCardSection`, `WorkWithMeSection`. Between them, availability, rate, booking windows, and a request flow **already exist** — closer to the charter's target than expected. `WorkWithMeSection` (the largest, main content) is a Services/Products marketplace layout (WhatsApp-Business-style), CTA text "Book Now" / "Select · {price}" / "Request", not carousel-based. Phase 3's work here is consolidating five separately-styled blocks into one coherent surface with one dominant CTA, not building booking/availability from scratch.

## 6. Skills

`SkillsSection.tsx` (mounted) uses `{ skill: string; level: number; category: string }` — **no confirmed/AI-suggested/inferred distinction exists at all**, flat list only. A second, incompatible `SkillsVerification.tsx` component exists with a different `Skill` shape and is not mounted on the Passport route — out of scope, not touched.

**Feasibility check (done before committing to a plan):** `profiles.professional_skills` / `profiles.passion_skills` are `Json | null` columns (confirmed via `types.ts:12554,12567`) — free-form, not a fixed Postgres schema. A `source: "confirmed" | "ai_suggested" | "inferred"` field can be added to each skill object **without a migration**. This is what Phase 3 will do.

## 7. Co-Signs — the most important finding of this audit

**Two unrelated systems currently share the "co-sign" name, and they are not the same thing:**

- **`ReviewsSection.tsx`** — literally labeled "Co-signs" in the tab bar, backed by `reviews`/`review_requests` tables, shape is `{ reviewer_name, rating, review_text, project_name, is_endorsed, is_verified, status }` — this is a **star-rating testimonial system** from past collaborators. Plain vertical list, no HoloCard.
- **`CreditVerificationPanel.tsx`** — labeled "Verification Requests" in its own UI (not a tab, always visible above the tabs), backed by `credit_endorsements`, status values `pending/accepted/declined/expired` — this is **evidence-verification for specific credits**, and this is the one with the HoloCard 3D treatment already built.

The charter's requested 4 categories — **Verified / Self-claimed / Pending / Publicly Sourced** — are evidence states of a *credit claim*, not sentiments of a *testimonial*. They map cleanly onto `credits.verification_status` (`verified`/`pending`/unset) plus provenance (`discovered_credits` / auto-import source vs. manually entered) — **not** onto the star-rating `reviews` table.

**Decision, documented here rather than made silently mid-edit:** Phase 3 builds the real 4-category Co-Sign carousel system around **credits + their endorsement/verification state** (extending `CreditVerificationPanel`'s already-built HoloCard cards), and leaves `ReviewsSection` as what it actually is — a testimonials feature — renaming its tab label from the confusing "Co-signs" to something honest (e.g. "Reviews") so the two systems stop colliding under one name. This is a UI/copy change only; no data is touched, no table is renamed, nothing is deleted. Both features keep functioning; they just stop pretending to be the same thing.

## 8. Studio (`/desk` → `WorkHome.tsx`, `/desk/:projectId` → `ThriveDesk.tsx`)

Confirmed already carousel-ized (real `Carousel` primitive + `CarouselPositionDots`): `SoundStagesRail`, `CastingCallsRail`, `RecentRecordingsRail`, plus an inline "Recent collaborators" carousel in `WorkHome.tsx`. **Still a plain CSS grid:** `StudioCardsGrid` — the actual project-room cards, the single biggest visual mass on Studio home. This is Phase 4's primary target: fold `StudioCardsGrid` and the already-carousel-ized rails into one condensed control-room layout instead of "hero grid + four more independent rails stacked below it."

`ThriveDesk.tsx` (single-project workspace) is already a tabbed workspace, not a card wall — lower priority for Phase 4.

## 9. New Room / New Project

**Two parallel, non-unified flows**, both writing to `projects`/`project_tasks` (consistent backend, good):
- `VoiceFirstCreateModal` — Studio home's "New project" button. Header "New room", headline **"What are you making?"** (matches the charter's example verbatim). Voice or text entry → AI extraction → review/edit → create.
- `CreateProjectWizard` (re-exported as `CreateProjectDialog`) — used by the global FAB, the in-room sidebar, and `ProjectsList.tsx`. 3-step form, step 1 is also titled "What are you making?", additionally writes `project_collaborators`. Embeds `VoiceFirstCreateModal` internally as a voice shortcut for its own step 1.

**Neither has draft persistence** — both fully reset state on close (same class of bug fixed in onboarding last phase). **Decision:** Phase 5 enhances `VoiceFirstCreateModal` (the primary Studio-home entry point) with the charter's fuller field set, stronger CTA copy, and draft persistence (matching the sessionStorage pattern already proven in `Onboarding.tsx`), rather than attempting to merge two independently-wired flows with different call sites into one component in this pass — that merge is a larger, separate risk than this charter's timeline supports responsibly. `CreateProjectWizard`'s other entry points are left working as-is.

## 10. Shared Liquid Glass primitives — all confirmed present and exported

`GlassSurface`, `GlassPanel`, `GlassNavbar`, `GlassInput`, `GlassButton`, `GlassDrawer` (+ subcomponents), `GlassModal` (+ subcomponents), `GlassCarousel`/`GlassCarouselItem`, `CarouselPositionDots`, `GlassStatusPill` — all live in `src/components/ui/glass/`, all re-exported from `index.ts`. Reused throughout this charter, not rebuilt.

## 11. Navigation

Confirmed clean: "Sound Stages" has no separate hamburger entry (already fixed, comment in place explaining why), only one "Stages" entry exists. No new duplicates found.

## 12. Existing carousels

Real `Carousel` primitive usage confirmed in exactly the files expected (the three Studio rails + inline WorkHome collaborators carousel). Confirmed still grid/list: `StudioCardsGrid`, `CreditsSection`, `UnifiedWorkHistory`, `CreditVerificationPanel`, `ReviewsSection`, `WorkWithMeSection` — these are the real conversion targets for Phases 3 and 4.

## Components to merge

- `ProfileHero` + `PassportClaimHero` → one unified 3D Passport hero (Phase 1).

## Components to keep as-is (reused, not rebuilt)

- `HoloCard` (3D shell), all 10 Glass primitives, `SoundStagesRail`/`CastingCallsRail`/`RecentRecordingsRail` (Studio rails), evidence-gated labeling logic in `AchievementCard`/`CreditsSection`/`UnifiedWorkHistory`.

## Components to convert (grid/list → carousel or condensed surface)

- `CreditsSection` (Stamps), `CreditVerificationPanel` (Co-Sign evidence cards → 4-category carousels), `StudioCardsGrid` (Studio project cards → control-room layout).

## Components to remove *visually* (unmount, never delete data or files)

- `PassportOverview` — already unmounted in a prior phase, stays that way.
- The duplicate hero (`ProfileHero`'s standalone block once merged into the unified card) — exact scope decided during Phase 1 implementation, see that commit.

## Routes affected

`/profile` (own + public view), `/credits/mine`, `/desk`, `/desk/:projectId`, wherever `VoiceFirstCreateModal`/`CreateProjectWizard` are invoked (`WorkHome`, `QuickActionFab`, `WorkspaceSidebar`, `ProjectsList`).

## Data that must remain untouched

Credits, skills (existing entries — only additive `source` tagging), portfolio data, Co-Sign/endorsement records (`credit_endorsements`, `credit_vouches`), review/testimonial records (`reviews`, `review_requests` — kept functioning under a relabeled tab), visibility settings, verification status/timestamps. No table renamed, no column dropped, no row deleted. No migration in this phase.

## Rollback plan

Every phase lands as its own commit on `feature/creative-passport-rearchitecture` (never `main`), verified with `tsc`/`eslint`-diff/`build` before commit, matching this branch's established discipline. Any phase can be reverted independently with `git revert <commit>` without affecting the others, since components are being merged/converted in place rather than having their underlying data or routes restructured. Nothing in this plan requires a database migration, so there is no live-database rollback concern — the entire rollback surface is git history.

## Outcome — what actually happened vs. this plan

Written after all 10 phases (0–9) landed; see [FINAL_QA_REPORT.md](FINAL_QA_REPORT.md)'s Charter C section for the full commit-by-commit account. Recording the deltas from this plan specifically, since a before-state audit is only useful if it's checked against what really shipped:

- **Followed as planned:** the `ProfileHero`+`PassportClaimHero` merge, the two-block post-Passport consolidation, the Co-Signs vs. Reviews split, the Stamps carousel conversion, the Studio control-room condensing, and the `VoiceFirstCreateModal`-only New Room enhancement (not merging in `CreateProjectWizard`).
- **Went further than planned:** extracted two shared components not originally scoped here — `FeatureHeader` (Phase 6, discovered Scout/Passport already duplicated one pattern exactly) and `SectionCard` (Phase 8, discovered the post-Passport/Studio blocks had independently converged on an identical shell). Both were "only if it genuinely reduces duplication" calls made in the moment, not predicted here.
- **Scoped down from the literal ask:** Skills' confirmed/suggested/inferred distinction shipped as a real, working mechanism, but no current code path produces an `ai_suggested` skill — both places skills get written already require user confirmation first, so there was nothing to retrofit without inventing an artificial trigger. Book Me's CTA rework was judged out of scope once Phase 3 established this tab is the owner's management view, not the visitor "hire" flow.
- **Not attempted:** merging `CreateProjectWizard` into `VoiceFirstCreateModal` (flagged here as a real, deliberate risk call, not an oversight), and the remaining ~95 files in the icon-button-labeling list (bounded, mechanical, continuable in further batches).
