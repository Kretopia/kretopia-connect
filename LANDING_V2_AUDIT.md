# Landing Page V2 — Phase 0 Audit

Charter: "Kretopia Landing Page V2 — Conversion-First Creative Passport Experience," executed on `feature/activation-priority-plan`. This document is the required classification gate — no section is edited until every section below has a verdict.

## Baseline gates (before any change)

- `git status` — clean except a pre-existing, untouched modification to `supabase/functions/mcp/index.ts` (present since before this charter began; not part of this work).
- `git branch --show-current` — `feature/activation-priority-plan`.
- `npx tsc --noEmit -p .` — clean, zero errors.
- `npm run build` — succeeds. Same pre-existing chunk-size warnings as documented in `GLOBAL_UX_QA.md` (unrelated to the landing page; `Discover`/`ThriveDesk`/main bundle).
- `npm run test -- --run` — 62/62 tests passing, 5/5 files.
- `npx eslint src` — baseline is thousands of pre-existing `@typescript-eslint/no-explicit-any` issues outside the landing directory; not this charter's concern except to not add new ones.

## Critical routing finding

**The actual live guest landing page is `KretopiaLanding.tsx`**, not the alternate `OneWedgeLanding.tsx` component that also exists in the codebase. Route trace: `/` → `DefaultRoute` (`src/App.tsx`) → for guests, `UnifiedHome.tsx` → unconditionally renders `<KretopiaLanding onSearchSubmit={...} />` (`src/components/home/UnifiedHome.tsx:469-473`, explicitly commented `"GUEST LANDING — Kretopia v1 (now canonical)"`).

`useLandingVariant()` (`src/hooks/useLandingVariant.ts`) is called and produces an `isWedge` boolean, but **`isWedge` is never read again after being computed** (`UnifiedHome.tsx:124`) — it's dead code left over from a retired A/B test. `OneWedgeLanding.tsx` is not reachable from any route. This charter's target is confirmed to be: `KretopiaHero.tsx` + `LandingBelowFold.tsx` (and its children) + `EditorialFooter.tsx`, orchestrated by `KretopiaLanding.tsx`, numbered via `chapterRegistry.ts`, navigated via `Navbar.tsx`.

`OneWedgeLanding.tsx` and its dead `isWedge` variable are flagged for a future cleanup pass but are **out of scope** for this charter (not touched, not deleted — removing dead code that isn't part of the requested work risks an unrelated regression and wasn't asked for).

## Current section order (top to bottom)

1. `Navbar.tsx` (persistent chrome, not a landing "chapter")
2. `KretopiaHero.tsx` — Search hero (critical path, chapter I)
3. `SearchTutorialSection.tsx` — tutorial for the hero's search (not numbered separately)
4. `ChapterSection` (Passport) — chapter II
5. `VerifiedCreditsChapterSection.tsx` — chapter III
6. `ChapterSection` (Scout) — chapter IV
7. `ChapterSection` (Match) — chapter V
8. `ChapterSection` (Studio) — chapter VI
9. `ChapterSection` (SoundStages) — chapter VII
10. `MeetKretoSection.tsx` (Kreto) — chapter VIII
11. `EditorialFooter.tsx`

No section currently exists for: a dedicated Discovery/three-step search-preview flow, a standalone Trust/Co-Sign principle section (trust language today lives *inside* the Verified Credits chapter, tied to one example credit — not framed as its own general principle), an interactive Passport→Scout→Match→Studio→stronger-Passport loop, a Creative Universe category grid, a merged Community section (SoundStages exists alone; Circle/events/auditions are not represented on the landing page at all), a For Organisations/hiring section, or a distinct closing-CTA section that echoes the hero.

## What's already right (confirmed via direct code read — matches the charter's "keep" list almost verbatim)

- **"Where Creativity Lives."** — present in the hero headline today (`KretopiaHero.tsx:76-78`).
- **"The opportunity finds you"** — present verbatim as the Scout chapter's title today.
- **"From idea to invoice. In one room."** — present verbatim as the Studio chapter's title today (charter phrases it as "From idea to invoice. / In one room." — a one-line-break difference only).
- **Kreto as AI Executive Producer** — already the explicit framing in `MeetKretoSection.tsx` ("The Executive Producer for your creative career," an "Executive Producer" card subtitle, an "AI-assisted" pill).
- **Trust/Co-Sign concept, with real states, not fabricated ones** — `VerifiedCreditsChapterSection.tsx` already drives its progression off `EVIDENCE_STATE_ORDER` from `src/lib/creditEvidence.ts` (`claimed → publicly_sourced → evidence_backed → co_signed → organization_confirmed`), and already explicitly labels its example credit "Illustrative — not live data." This is the correct terminology source to reuse for Phase 4, not a new invention.
- **Real Passport UI, real Search** — the hero's search is the actual `UnifiedSearchDropdown` (real Supabase queries, real voice search, real fuzzy matching), not a mockup. No fake results exist anywhere in the current landing page.
- **Search-first hero, single dominant CTA already** — the current hero already has no competing button row under the search bar (a prior pass removed one); the search field's own submit button is already the only primary action in the first viewport.
- **Cinematic dark visual language, reduced-motion support, lazy below-fold loading** — `KretopiaLanding.tsx` already defers everything but the hero via `IntersectionObserver` + idle-callback, and `ChapterSection.tsx` already respects `useReducedMotion()`.

## What's genuinely wrong or missing (the real work of this charter)

- **Copy drift from the charter's exact hero script.** Current eyebrow ("Kretopia — The Creative Economy OS"), headline ("Welcome to Kretopia. / Where creativity lives."), supporting line ("Search the Creative Global Record"), and microcopy ("Free. No card. Built for creators.") all differ from the charter's specified copy. This is Phase 1's real, concrete task.
- **Primary nav CTA is generic.** Navbar's guest primary button is **"Get Started"** → `/auth?tab=signup` — exactly the generic copy the charter says to avoid as a primary conversion action. Secondary is "Hire Talent" → `/post-opportunity`.
- **Per-chapter CTAs are feature-first, not Passport-first.** Every chapter's CTA is "Enter {Feature}" (Passport/Scout/Match/Studio/SoundStages all route straight to `/auth?next=/{route}`) or one-off phrasing ("Explore Verified Credits," "Meet Kreto"). None reinforce "Search Your Name" / "Claim Your Passport" as the two CTAs the whole page should funnel toward.
- **No analytics on the landing page today.** Confirmed by grep: zero `analytics.`/`track(` calls in `KretopiaHero.tsx`, `ChapterSection.tsx`, `MeetKretoSection.tsx`, `VerifiedCreditsChapterSection.tsx`, `SearchTutorialSection.tsx`, `LandingBelowFold.tsx`, or `EditorialFooter.tsx` — despite `src/lib/analytics.ts` already having a full activation-funnel event set built for exactly this (`searchStarted`, `passportFound`, `claimStarted`, `ctaClick`, etc., under the `FEATURE_SEARCH_V2` flag family). This is real, existing infrastructure the landing page simply never calls.
- **No Discovery/preview section.** The charter's Phase 2 ("Your creative history may already be here" / Search → Review → Claim) doesn't exist. The hero's search already *can* show real name/role/location preview results pre-auth (confirmed in `UnifiedSearchDropdown.tsx`), but nothing on the page explains that capability or invites a visitor to try it before scrolling into unrelated chapters.
- **No standalone Trust section.** Trust language is scoped to one credit-evidence example inside the Verified Credits chapter; the charter wants a separate, general-principle section (Phase 4) independent of that specific chapter.
- **No Product Loop visual.** Nothing ties Passport → Scout → Match → Studio → stronger Passport together as one system; today they read as 5 sequential, separately-numbered chapters with no explicit closing-the-loop moment.
- **No Creative Universe category grid, no merged Community section, no For Organisations section.** All three are net-new.
- **No closing CTA section.** The page ends at Kreto → Footer, with no return to the hero's core wedge (search + claim) at the bottom.
- **Mobile has no narrow-viewport-specific verification.** `tailwind.config.ts` adds only one custom breakpoint (`xs: 475px`); `KretopiaHero.tsx` and `ChapterSection.tsx` rely on fluid/clamp sizing rather than discrete 375/390/430px rules — not necessarily wrong (fluid sizing is often the more robust approach), but it means this charter's required 375/390/430px checks must be done as live verification, not assumed from the code.
- **No community/Bali/Caribbean photography assets exist in the repo.** `src/assets/` has no such images — the charter's Phase 11 ask ("real community imagery where available... Bali... Caribbean") has nothing "available" to draw on. This will be called out explicitly rather than silently faked with unrelated stock-feeling imagery or invented photography.

## Section-by-section classification

| # | Section | File(s) | Verdict | Why |
|---|---|---|---|---|
| — | Navbar primary/secondary CTA | `src/components/Navbar.tsx` | **Rewrite (copy only)** | "Get Started" → the charter's primary CTA framing; add "Claim Your Passport" as the primary landing-page action. Auth routing, guest nav items, hamburger Sheet, and all authenticated-nav logic stay untouched. |
| I | Hero (`KretopiaHero.tsx`) | `src/components/landing/KretopiaHero.tsx` | **Rewrite (copy + minor structure)** | Structure (search-first, no competing buttons, lazy below-fold) is already correct; eyebrow/headline/subcopy/placeholder/microcopy all need to match the charter's exact script. Wire the existing `analytics.searchStarted`/`ctaClick` calls here — currently missing entirely. |
| — | Discovery / Search-Review-Claim | *(new)* | **New section** | Insert directly below the hero, before Passport. Reuses the same real `UnifiedSearchDropdown` preview behavior already proven safe (no auth-gate on preview results) — no new backend behavior invented. |
| II | Passport chapter | `ChapterSection` instance in `LandingBelowFold.tsx` | **Simplify + retitle CTA** | Visual/copy direction is close; change the "Enter Passport" CTA language toward the charter's Passport CTA framing ("Build Your Passport") and tighten copy to the four-concept (Credits/Projects/Co-Signs/Evidence) structure the charter specifies. |
| III | Verified Credits chapter | `VerifiedCreditsChapterSection.tsx` | **Keep, feed into new Trust section** | This component's real evidence-state mechanism is correct and should not be rebuilt — but the charter's Phase 4 (general Trust principle) is a distinct, simpler section that should sit near it, reusing its already-correct terminology (Claimed/Publicly Sourced/Co-Signed/Organization Confirmed/Evidence-backed) rather than inventing new labels. |
| — | Trust / Co-Signs (general principle) | *(new)* | **New section** | Built from real terms already established by `creditEvidence.ts`, not invented ones. |
| — | Product Loop (Passport→Scout→Match→Studio→stronger Passport) | *(new)* | **New section** | Nothing like this exists anywhere in the codebase (confirmed by search) — genuinely new, interactive, hover/click-driven, mobile vertical-step fallback. |
| IV | Scout chapter | `ChapterSection` instance | **Keep copy, simplify CTA** | Title ("The opportunity finds you") is already the charter's exact language. Retitle CTA toward "Explore Opportunities" per charter. Reduce AI-forward language if any creeps in beyond what's already there (currently minimal — good). |
| V | Match chapter | `ChapterSection` instance | **Rewrite copy, keep structure** | Current copy is close but not identical to the charter's script; retitle CTA to "Find Collaborators." |
| VI | Studio chapter | `ChapterSection` instance | **Keep title, tighten copy** | Title ("From idea to invoice. In one room.") matches. Add the charter's mandatory line connecting Studio's outcome back to strengthening Passports (currently only implicit). CTA → "Create a Project." |
| VII | SoundStages chapter | `ChapterSection` instance | **Merge into Community** | Per the charter's explicit instruction not to give SoundStages/Circle/events separate large sections — fold into one "Beyond the Screen" Community section alongside Circle/events, rather than keeping it as its own numbered chapter. |
| — | Creative Universe (category grid) | *(new)* | **New section**, visual-first, no stock photography invented — see asset-gap note above; will use typographic/iconographic treatment instead of fabricated photography. |
| — | Community (merged SoundStages + Circle + events) | *(new, replaces standalone SoundStages chapter)* | **New/merge** | Per asset-gap note, will not fabricate Bali/Caribbean photography that doesn't exist in the repo — copy will describe the real, existing SoundStages/Circle features without implying photographic "real people" content that isn't available. |
| VIII | Kreto (`MeetKretoSection.tsx`) | `src/components/landing/kretopia/MeetKretoSection.tsx` | **Simplify** | Already has the right framing and a real non-agentic disclaimer. Currently lists 6 capabilities; charter wants exactly 3 concepts (Understands your work / Helps you act / You stay in control). Consolidate the existing 6 into 3, don't invent new capabilities. |
| — | For Organisations | *(new)* | **New section**, shorter than the creator journey per the charter, built only from real routes/features that exist (`/post-opportunity` and related — verified this route exists and is wired). |
| — | Closing CTA | *(new)* | **New section**, echoes the hero exactly per the charter's script, before the footer. |
| — | Footer | `EditorialFooter.tsx` | **Keep, minor addition** | Structure/links are fine and out of scope to rebuild; the "Where Creativity Lives." signature the charter wants at the very close of the page will live in the new Closing CTA section immediately above the footer, not by rebuilding the footer itself. |
| — | Chapter numbering | `chapterRegistry.ts`, `ChapterProgressNav.tsx` | **Update in lockstep** | `chapterNumber()` throws if a section `id` isn't registered — every add/remove/reorder above must be mirrored here in the same commit, or the page crashes. Community-merge removes the standalone SoundStages entry; new major sections (Product Loop, Creative Universe, if given anchor ids) get added only if they should participate in the jump-nav — decision made per-section during implementation, not fixed here. |
| — | Analytics | `src/lib/analytics.ts` (existing, unused by landing) | **Wire, don't invent** | Every event the charter's Analytics section asks for already has a matching function in `analytics.ts` (`searchStarted`, `passportFound`, `claimStarted`, `ctaClick`, `featureUsed`, etc.) — Phase-by-phase work is to call these from the right places, not create a parallel tracking system. |

## Do-not-touch confirmation

No RLS, authentication, payments, migrations, secrets, or user-record logic exists in any file classified above — every touched file is presentation-layer (React components + copy + Tailwind classes) or a `.md` doc. `UnifiedSearchDropdown.tsx`'s real Supabase queries will be *consumed*, not modified, by the new Discovery section.

## Plan for phases 1–13

Proceeding phase-by-phase per the charter, committing after each, starting with Phase 1 (Hero rewrite). No merge to `main` at any point without explicit user go-ahead, consistent with every other charter executed on this branch.
