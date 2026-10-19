# Opportunity ranking

Docs only. No UI or backend change.

## What exists
`src/lib/opportunityMatch.ts` `computeOpportunityMatch` returns `Math.min(97, 55 + relevance * 6)` or `null`. Any overlap at all therefore shows 61 to 97, and `GigCard` / `GigRailCard` display it as a match badge. The 55 is an offset, not evidence: it is a vanity number and must not be presented as fit. First required change: stop showing a number; show the reasons (below). The relevance count underneath (skills +3, title +2, role +2, city +1) is a usable internal weight.

## Ranking signals
| Signal | Source | Rule |
|---|---|---|
| Real fit | opportunity `skills`, `tags`, `type`, `title` against the viewer's skills and role | internal weight; zero fit means not shown in "for you" |
| Availability | the opportunity's dates against `creator_availability_blocks` | hard filter when both are known |
| Verified experience | the viewer's credits in the same category that are verified or co-signed | weight by proof state, never self-declared |
| Complementarity | for team gigs: roles already filled versus the viewer's craft | boost only if the gig lists the team |
| Freshness | posted date and deadline | decay with age; expired is hidden; closing soon is labelled, not boosted |
| Intent | `intentBoostForGig` | small boost, labelled "matches your intent" |

## Order
1. Filter: open, not expired, not blocked, not already applied, location rule satisfied.
2. Sort by the weight, then freshness, then id (stable).
3. Paid placement is allowed only if labelled "Sponsored" and kept out of the "for you" order.

## "Why this is shown" (required on every card)
One to three short reasons, each from a field: "You list Colour grading", "Your credit on Project X is verified", "Closes in 3 days", "In Lagos, where you are". If nothing real applies, the card appears only in browse and search, never in "for you".

## Bans
No percentage, no star score, no "best match" claim, no AI-written fit, no default reasons, no ranking by engagement alone.

## Measure
Apply rate and accepted rate by position and by reason shown, from `applications` and `analytics_events`. A reason that never leads to an application is removed.

## Order of work
1. Remove the number from the badge; show reasons (UI, needs approval). 2. Add availability and verified-experience signals. 3. Add the "why" line to every card. 4. Measure, then tune.
