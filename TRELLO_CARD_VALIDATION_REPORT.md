# Trello Card Validation Report

Section 12 of the August 31 release charter: complete all safe Trello cards with evidence, mark unsafe ones REQUIRES_MANUAL_PRODUCTION_ACTION.

Compiled: 2026-08-18. Repo: `/Users/noeplantier/thrivein-new-beta`, branch `feature/activation-priority-plan`.

## 1. Approach

[TRELLO_RELEASE_INVENTORY.md](TRELLO_RELEASE_INVENTORY.md) catalogs 34 cards. Working through all 34 to full DONE_AND_VERIFIED in one pass isn't realistic or honest — most require either a human design-judgment call (2.3, 8.3 in part), a live QA walkthrough of a running feature with real user interaction (2.1, 2.2, 3.x, 4.x, 5.3), or are explicitly blocked on non-code work (the whole Blocked list, 8.1/8.2/8.4-8.6). This pass targeted the subset that was both **safe** (no production migration, no live payment, no email send) and **concretely actionable from the repo alone** — verification-only or small, well-evidenced fixes — rather than performing a shallow pass across all 34.

## 2. Cards advanced this pass

### 5.1 — Test milestone payment lifecycle (highest priority)
The inventory itself flagged this as **"the highest-stakes discrepancy found in this entire catalog"**: a direct contradiction between the `thrivefund_milestone_release_idempotency` migration file's own header (which said "NOT YET APPLIED") and `SECURITY_RELEASE_GATE.md` (which claimed it was applied and verified) — a real-money double-spend risk if the wrong one was true.

**Resolved.** The underlying fact was already independently confirmed earlier in this engagement via a direct read-only query against production (`information_schema.tables` confirmed the table exists) — the migration file's comment was simply stale, never updated after being written-for-review and then applied. Corrected the comment (commit `1e12afa7`) so the in-repo record no longer contradicts itself, and confirmed via grep that the edge-function side (commit `25fa0425`) is genuinely wired to read/write the table at 3 call sites. One narrower question remains open and is called out explicitly in the card: whether that edge-function code is *deployed* on the Edge Functions runtime, not just present in the repo — this needs either a Lovable Cloud dashboard check or a safe unauthenticated probe, neither of which this pass attempted (to avoid any risk of touching real Stripe transfer logic without explicit sign-off).

### 8.3 — Prepare product narrative and visuals (branding criterion)
One of four acceptance criteria — "No obsolete ThriveIN branding appears in user-facing surfaces" — had only been sample-checked (3 of a stale 20-file count) during board ingestion.

**Resolved.** Ran a fresh `grep -ril thrivein src/` (34 files — the board's count was already stale) and read every hit. 30 were storage keys, config identifiers, or a legitimately-defensive reserved-subdomain-slug entry. **4 were real leaks**, all in the Magazine feature and all in genuinely user/SEO-visible surfaces: a fallback article subtitle, a default `author_name` written into the database on every new article, and the page `<title>`/meta description/`og:site_name`/JSON-LD fields across `Magazine.tsx` and `MagazineArticlePage.tsx`. Fixed all four to say "Kretopia Magazine" (commit `830b8036`), verified via `tsc`, `build`, and the full test suite (68/68) — this is a genuine rebrand miss that had gone unnoticed, not a false positive.

### 6.2 — Run cross-product UX consistency pass (cross-reference)
The first acceptance criterion, "Shared FeaturePageHeader is used," is directly advanced by this session's own Section 8 work: [MAJOR_PAGE_UX_OVERHAUL.md](MAJOR_PAGE_UX_OVERHAUL.md) documents extracting `CinematicHeaderPlate.tsx` so `FeaturePageHeader` and `EditorialPageHero` (previously hand-matched duplicates, not literally shared) now render from one component — verified live across all five 6.2-relevant surfaces plus Scout. Cross-referenced in the inventory rather than re-litigated, since the evidence already exists in a prior section's commit.

## 3. Cards requiring REQUIRES_MANUAL_PRODUCTION_ACTION or explicit sign-off

- **5.1's remaining edge-function-deployment question** (above) — needs a Lovable Cloud dashboard check, not code.
- **Everything in the Blocked list** (B.1–B.3) — the live-demo storyboard/backup-video/team-resilience chain is a filming/rehearsal task, not code; B.1 is already overdue and needs the team to unblock it directly.
- **8.1, 8.2, 8.4, 8.5, 8.6** — demo prep, technical demo environment, final regression, CEO acceptance, and the actual Aug 31 submission are all sequenced *after* the P0 lists stabilize and involve real accounts/rehearsal/human sign-off, not something to fabricate evidence for from a repo pass.
- **2.3** — "Review Passport as the core product" is an explicit design-judgment call assigned to Jefferson; a code grep cannot substitute for that review.
- **1.1, 1.4** — both already have substantive, real audit work behind them ([SECURITY_RELEASE_GATE.md](SECURITY_RELEASE_GATE.md), [EMAIL_RELEASE_AUDIT.md](EMAIL_RELEASE_AUDIT.md)) but each has specific, named open findings (3 WARN-level RLS items on 1.1; unescaped-HTML-interpolation and dead-code findings on 1.4) that need triage decisions, not blind fixes, before either card can honestly close.
- **Every card whose evidence gap is "no recorded end-to-end test run"** (2.1, 2.2, 2.4, 3.1–3.3, 4.1–4.4, 5.2, 5.3, 6.1, 6.4, 7.1–7.3) — these need an actual QA walkthrough of live functionality (clicking through real flows, checking real database state), which is exactly the work Section 9 of this same charter partially covers for the pages this session touched, but the majority of these cards span features (Scout, Studio, VideoCall, Kreto, milestone payments) well outside this session's actual code changes. Fabricating "verified" status for features this session didn't touch or test would be dishonest; they remain IMPLEMENTED_NOT_VERIFIED or PARTIALLY_IMPLEMENTED as the inventory already has them, pending a real QA pass by whoever owns each surface.

## 4. Verification

`npx tsc --noEmit -p .` clean, `npm run build` clean, `npm run test -- --run` 68/68 passing after all changes in this section. Three commits: `1e12afa7` (migration comment), `830b8036` (branding fix), `b9495a48` (inventory updates).
