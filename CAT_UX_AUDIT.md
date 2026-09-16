# CAT — UX Audit

> **Correction:** the user clarified mid-session that "CAT" was a typo for **"CTA"** (call to action) — there is no distinct product feature by either name. This document is retained as an honest record of the search performed (the instruction was explicit about not fabricating a feature), but no further work targets "CAT." The actual intent — auditing and strengthening each major route's primary call-to-action — is carried forward into `PRIMARY_SURFACE_AUDIT.md`, which already covers exactly this (a `Primary CTA` column per route) as part of the information-hierarchy pass.

## Method

Per the explicit instruction not to invent or guess, this audit used whole-word/word-boundary searches only (`grep -rnw "CAT"`, `grep -rnw "Cat"`, `\bCAT\b` regex sweeps), not a naive substring search — a plain case-insensitive `cat` search would return hundreds of false positives from words like *Category*, *Location*, *Verification*, *Notification*, *Duplicate*, *Indicator*, *Certificate*, *Concatenate*. Every hit below was manually checked against its surrounding code/context.

Searched: all of `src/`, all of `supabase/` (functions, migrations), `src/integrations/supabase/types.ts` (full schema), `src/lib/featureFlags.ts` (full file), `src/App.tsx` (every route), rendered JSX text content, `README.md`, `package.json`.

## Findings

| Area | Result |
|---|---|
| Current meaning | **Not found.** No standalone `CAT`/`Cat` identifier, acronym, or product term exists anywhere in the repository. |
| Current routes | **None.** No route path is `/cat`, `/cats`, or has "cat" as a distinct segment. |
| Current components | **None.** Of 44 files matching `*cat*` in their filename, every one is a substring false positive (`LocationCard.tsx`, `VerificationBadge.tsx`, `NotificationCenter.tsx`, `DuplicateAccountBanner.tsx`, `ExpenseCategories.ts`, etc.) — none is a genuine `Cat`-prefixed component. |
| Current database queries | **None.** No table or column named `cat`/`CAT` exists in the generated Supabase types. |
| Current copy | **None.** No JSX text content or string literal contains the standalone word `CAT`. |
| Current navigation items | **None.** |
| Current feature flags | **None.** The 10 flags in `featureFlags.ts` (`FEATURE_SEARCH_V2`, `FEATURE_CREATIVE_RECORD`, `FEATURE_DISCOVERIES_V2`, `FEATURE_PASSPORT_REVEAL`, `FEATURE_AI_DRAFTS`, `FEATURE_ACTIVATION_CENTER_V2`, `FEATURE_RECOMMENDATIONS`, `FEATURE_OPPORTUNITIES_V2`, `FEATURE_NEBIUS_INFERENCE`, `FEATURE_MINIMAX_INFERENCE`) contain nothing matching. |
| Current user value | N/A — no feature exists to have value. |
| Current visibility | N/A |
| Current blockers | The blocker is definitional: there is no evidence in this codebase of what "CAT" is meant to refer to. |
| Relationship to Passport / Studio / Scout / Kreto / Co-Signs | None found. |
| Recommended primary user action | Cannot be defined without knowing what CAT is. |

The two closest matches, both confirmed as unrelated:
- `src/pages/Meetup.tsx:36,44` — a local TypeScript type `type Cat = typeof CATEGORIES[number]` — shorthand for "Category" (music/film/design/etc. meetup filters), not an unrelated concept.
- `supabase/functions/auto-discover-creatives/index.ts:120` — the string `"doja cat"`, a musician's name in an outreach-targeting list.

## Decision

Per the explicit instruction — *"If CAT is not implemented or its meaning cannot be confirmed: do not fabricate functionality; create only a clear documented placeholder; report exactly what is missing"* — and the separate, equally explicit instruction that *"CAT must not become a decorative card. It must represent a real action or meaningful product capability"*:

**No UI, route, or component was built for CAT.** A placeholder card or nav entry for a feature whose meaning is unconfirmed would itself be the kind of fabrication these instructions rule out — a real user would see something that promises a capability nobody defined. Instead, this document *is* the placeholder: a clear, honest record that the search was done thoroughly, nothing was found, and no functionality should be attached to the term "CAT" until its intended meaning is confirmed by whoever specified this requirement.

**What's needed to unblock this:** a pointer to what CAT is meant to be — a design doc, a Slack/email thread, a spec, or confirmation that it's a misremembering of an existing feature (candidates already in the product: **Verified Credits** / **Passport Stamps**, **Co-Sign**, **Scout**, **Circle**, **Casting**). Once confirmed, this phase can be re-run with a real target.

Proceeding with the remaining phases of this pass (Liquid Glass refinement, primary information hierarchy, Passport redesign, animation system, cross-feature QA), none of which depend on CAT.
