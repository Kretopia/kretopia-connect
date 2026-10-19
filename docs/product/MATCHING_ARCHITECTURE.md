# Matching architecture

Docs only. Matching is not rewritten. This fixes the target shape so the existing modules grow in one direction.

## What exists
- `src/lib/matchScoring.ts`: `computeMatchScore` returns a ranking weight, `MATCH_SCORE_MAX = 130` (craft 40, or complementary craft 30, plus up to two new skills at 5 each, city 25, past collaborator 35, skills 20, jitter 10). It is not a percentage and is never shown as one.
- `src/lib/matchComplement.ts` (`isComplementaryCraft`, `skillsTheyBring`), `src/lib/matchReasons.ts` (`buildMatchReasons`), `src/lib/matchRanking.ts` (`RankableCandidate`, `diversifyByRole`, `isPositivelyRealMember`), `src/lib/intentMatching.ts`.
- Candidate source: `public_profiles_safe`; imported (unclaimed) profiles are excluded by `isPositivelyRealMember`.

## Two modes
| | `SIMILAR_CREATIVES` | `BUILD_A_TEAM` |
|---|---|---|
| Input | the viewer's Passport | a project brief with required roles |
| Output | ranked people like the viewer | one ranked shortlist **per role**, plus a team view |
| Goal | peers, learning, scenes | cover every role with people who can work together |
| Complementarity | low weight | high weight, measured against the team already chosen |

## Signals (each must come from a real field)
| Signal | Source today | Note |
|---|---|---|
| Verified credits | `credits` classified by `classifyCreditEvidence` (verified, co-signed, publicly sourced, pending, self-declared) | count only proof states, not self-declared |
| Co-signs | `credit_vouches`, `credit_endorsements` | who vouched, for which credit |
| Skills | `profiles.professional_skills` | exact and near overlap |
| Availability | `creator_availability_blocks` | hard filter for `BUILD_A_TEAM` |
| Timezone | not a field today | derive from city until a field is approved; do not guess |
| Activity | `profiles.updated_at`, recent actions | `RECENT_ACTIVITY_DAYS = 14` |
| Complementarity | `isComplementaryCraft`, `skillsTheyBring` | new skills the candidate adds |
| Collaboration history | `fetchPastCollaboratorIds` | strongest single signal |

## Ranking contract
1. Hard filters first: blocked users (`user_blocks`), already actioned, not a real member, not available (team mode).
2. Weighted sum, internal only. Ties: `byRankThenStable` (score, recency, id) so order is deterministic.
3. `diversifyByRole` within a small window; never reorder far from the score.
4. Nobody is hidden for scoring low: if filters leave too few, backfill with a note saying so.

## Required explanation per result
Every result carries `reasons[]`, each tied to a field (`MatchReasonKey`): shared craft, complementary craft and the skills it adds, same city, worked together before, recently active, already interested in you. In `BUILD_A_TEAM`, each slot also says which role it fills and what the team lacks without it. No reasons: say "No shared craft, skills, city or history yet" and let the person decide.

## Bans
- No percentages, "% match", stars, or "perfect match" labels derived from the weight.
- No AI-generated score or ranking. AI may only reword reasons that are already computed; it receives structured signals and returns text, never new facts.
- No default or fallback reasons when data is missing. `generate-match-explanation` no longer invents a score on failure.
- No pay-to-rank without a visible "Sponsored" label.

## Measurement
Acceptance by rank position, reasons shown versus acted on, and time to first reply, from `swipes`, `connections`, and `analytics_events` (`KRETOPIA_LOOP_METRICS.md`). Tune weights only against these.

## Next, when approved
Add one typed `ExplainedCandidate { candidate, rankWeight, reasons[], mode }` next to `RankableCandidate`; add the team-coverage function for `BUILD_A_TEAM`; add a timezone field if the metric shows it matters.
