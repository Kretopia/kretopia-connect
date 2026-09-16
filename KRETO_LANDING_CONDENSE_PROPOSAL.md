# Kreto Landing — Condense Proposal (P1)

**Status: proposal only. No landing files have been edited.** This is the section-by-section review the audit's own §N caution required before touching anything ("any P1 work here should condense/reorder with explicit section-by-section sign-off, not a unilateral cut") — the lesson being that an earlier assumption of "landing page bloat" this project made was wrong; this page's structure was deliberate.

## The ground rule this proposal respects

`chapterRegistry.ts:17-26` defines exactly **8 numbered chapters** — Search, Passport, Verified Credits, Scout, Match, Studio, Kreto, Community — and `KretopiaLanding.tsx`'s own top-of-file docstring documents this same 8-chapter spine as the deliberate "cinematic editorial" structure ("no SaaS bloat — no comparison tables, no pricing grids, no feature checklists"). **This proposal does not touch any of those 8.**

The page actually renders **13** sections. The other **5** (`InlineSignupBar`, `TrustSection`, `ProductLoopSection`, `CreativeUniverseSection`, `ForOrganisationsSection`) plus `ClosingCTASection` sit *outside* that numbered spine — inserted connective/conversion tissue, not part of the documented narrative. That's where this proposal focuses, because that's the part the team's own registry never claimed was sacred.

## Section-by-section

| # | Section | In spine? | Tracking | Recommendation |
|---|---|---|---|---|
| 1 | SearchTutorialSection | Yes (I. Search) | ✅ CTA click | **Keep as-is.** It's the Hero's own tutorial, not a separate pitch. |
| 2 | InlineSignupBar | No | ✅ CTA click | **Keep as-is.** Copy is near-identical to Hero/ClosingCTA ("Claim your Passport" / "Free forever · No credit card"), but `KretopiaHero.tsx:248-252` documents *why* it exists: "82% of landing visitors were never reaching /auth at all, and search alone was the only route there." This is a metrics-driven fix already made — removing it would regress a known problem, not condense one. |
| 3–6 | ChapterSection ×4 (Passport/Scout/Match/Studio) | Yes | ✅ CTA click each | **Keep as-is.** Documented spine. |
| 7 | VerifiedCreditsChapterSection | Yes (III.) | ✅ CTA click | **Keep as-is.** Documented spine. |
| 8 | TrustSection | No | ❌ none | **Cut, fold its one line into #7.** It renders the *same* evidence-progression data (`EVIDENCE_STATE_ORDER`) VerifiedCreditsChapterSection just showed one scroll earlier — literally the same source of truth, shown twice. It has no CTA and no click tracking, so removing it costs zero measured conversion path. Its one distinct line — "Don't just claim it. Prove it." — is worth keeping as a closing beat *inside* VerifiedCreditsChapterSection rather than as a whole separate un-tracked section. |
| 9 | ProductLoopSection | No | ⚠️ view-only (`analytics.featureUsed`, no CTA) | **Keep, but fix the instrumentation gap.** This isn't redundant filler — it sits *after* the four chapters and visually closes the loop ("your past work creates your next opportunity"), which is the actual thesis of the product. But it's currently a dead end: no exit link, no `trackLandingCta*` call. Recommend adding a single soft CTA at its close (e.for example, "See how it starts" → back to Passport chapter's CTA) so a section this central to the pitch isn't unmeasured. |
| 10 | MeetKretoSection | Yes (VII. Kreto) | ⚠️ partial | **Keep as-is, fix a tracking gap.** Main CTA is tracked; the 4 "Try asking" prompt chips are not (`MeetKretoSection.tsx:245-256`). Low-risk, mechanical fix — add `trackLandingCtaClick` to those 4 chips. Not a content change. |
| 11 | CreativeUniverseSection | No | ❌ none | **Cut, or shrink to a strip.** Purely decorative 12-icon category grid, no CTA, no click tracking, no claim not already implied elsewhere. This is the one section that's genuinely just visual "worldbuilding" with no conversion role — but it does establish creative-industry breadth, which is part of the page's tone. Two options below (see sign-off question). |
| 12 | ChapterSection (Community) | Yes (VIII.) | ✅ CTA click | **Keep as-is.** Documented spine — and its own inline comment already records a prior, successful consolidation (merged SoundStages + Circle + events into one section instead of three), which is good precedent for how this proposal's own cuts should work. |
| 13 | ForOrganisationsSection | No | ✅ CTA click ×2 | **Keep as-is.** Own docstring already frames it as "deliberately shorter... never allowed to compete with the hero." B2B-audience-segmented, not redundant with the creator-facing CTAs above it. |
| — | ClosingCTASection | No (final beat) | ✅ CTA click ×2 | **Keep as-is.** Necessary final conversion step; dynamic live user count, no invented data. Not a condensing target. |

**Net effect if the two cuts above are approved: 13 sections → 11**, removing the two sections with zero click-tracking and zero unique, non-duplicated content, while leaving every numbered chapter and every already-tracked conversion beat untouched.

## Separate, low-risk fixes found during this research (not content decisions — will do regardless unless told otherwise)

1. **Dead A/B-test scaffolding**: `src/hooks/useLandingVariant.ts` is a retired experiment hardcoded to always return `"wedge"` (its own comment says so) — still writes exposure telemetry to a `site_analytics` table for an experiment with no control arm left, and feeds an `isWedge` variable in `UnifiedHome.tsx` that's never read again after being computed. `src/components/landing/OneWedgeLanding.tsx` is fully orphaned (imported nowhere). Recommend removing both files and the dead call site — genuinely unused, not a "the spine is deliberate" case.
2. **Stale funnel data**: `src/lib/landingFunnel.ts:21-35`'s `LANDING_SECTION_ORDER` has two wrong DOM ids (`chapter-credits`/`chapter-soundstages` should be `chapter-verified-credits`/`chapter-community`) and is missing `chapter-universe`/`inline-signup` — meaning `landing_section_viewed` analytics events for those sections currently record the wrong index. One-line data fix, not a UI change.

## Open questions requiring your sign-off

Two content decisions (TrustSection fold, CreativeUniverseSection cut-vs-shrink) and one dormant-content decision (FAQSection) are asked below via AskUserQuestion. Everything else in this doc I'll treat as pre-approved to fix mechanically (tracking gaps, stale ids, dead A/B code) unless you say otherwise, since none of those change visible content or copy.
