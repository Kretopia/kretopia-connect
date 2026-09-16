---
name: Passport Positioning v1
description: Locked positioning line + wedge strategy for the Creative Passport. Use everywhere the Passport is pitched.
type: preference
---

**Locked headline (do not paraphrase):**
"The verified creative record the industry has been waiting for."

**Subline:**
"One Passport. Every credit. Co-signed by the people who were actually there."

Both exported from `src/lib/brandLexicon.ts` as `BRAND.passportHeadline` and `BRAND.passportSubline`. Always import from there.

**Primary wedge:** "Tagged-but-unclaimed" — fire `<TaggedCreditsClaimCTA />` or the inline banner inside `<PassportClaimHero />` (via `taggedCount` prop) whenever a user has `discovered_credits` rows where `approved_at IS NULL AND dismissed_at IS NULL`. Hook: `useTaggedCredits(userId)`.

**Public surfaces:** `/passport` (directory), `/@:handle`, `/passport/:passportId` — all resolve to public EPK. Indexed in sitemap. SEO uses `BRAND.passportHeadline` as description.

**Why:** the Passport is the moat. Every other product surface (Desk, SoundStages, Pay, Scout) is a proof-generator for the Passport, not the other way around.
