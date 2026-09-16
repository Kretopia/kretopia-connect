# Kreto Rollout — Phase C (Selective Contextual Expansion)

Phase C surfaces per the brief: Events, Stage, Recordings, Messages empty states.

## Status: `IMPLEMENTED` (Events, Stage) / `NOT_STARTED` (Recordings enrollment, Messages)

| Surface | Status | Detail |
|---|---|---|
| Events | `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` | `KretoTip.tsx`'s `/meetup`\|`/events` group. Verified via real route matching (`/events` and `/meetup` both resolve to the Events group and render the embodied presence) since `KretoTip`'s `surface` prop override doesn't cover this group. |
| Stage / Circle | `IMPLEMENTED`, `TYPECHECKED`, `UNIT_TESTED`, `BROWSER_VERIFIED` | `KretoTip.tsx`'s `/circle`\|`/stages` group, plus `Circle.tsx` now explicitly mounts `<KretoTip compact />` (closing the gap where the group existed but no page rendered it — see prior turn's commit `31106d70`). Live-verified on `/circle`: tip card renders above the Stages/Match/Browse/Network tabs, embodied presence visible. |
| Recordings | `NOT_STARTED` for the embodied presence; `KretoTip` already mounted | `Recordings.tsx:126` already has `<KretoTip compact />`, but its eyebrow ("Recordings") is not in `PRESENCE_EYEBROWS`, so it correctly still renders the flat `KretoMark`. Enrolling it is a one-line addition to the set plus the same verification pass every other surface got — low-risk, not started because it hasn't been explicitly approved yet. |
| Messages | `NOT_STARTED` | No `KretoTip`/`KretoPresence` reference anywhere in `Messages.tsx`. The brief's own rule here is stricter than the other Phase C surfaces ("empty state or optional reply-draft surface... do not sit inside every message thread"), so this needs a dedicated placement decision, not the same `<KretoTip compact />` drop-in used elsewhere — implementing it as a generic mount would risk violating that specific constraint. |

## `stages` route caveat (carried forward, unresolved)

`/stages` has no registered route in `App.tsx` at all (confirmed via grep in the prior rollout turn) — the `KretoTip` route-matching logic correctly handles it as an alias of the Circle group, but there is no actual page a user could land on at that path today. Not a regression from this work; flagged again here since it's directly relevant to this surface's real-world reach.

## What "Phase C complete" requires

Recordings enrolled and verified; Messages given its own approved empty-state placement and implemented; both updated to `IMPLEMENTED` in this report.
