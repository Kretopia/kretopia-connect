# Studio Information Architecture — Overhaul

## State A — Studio home (`/desk`)
1. `FeaturePageHeader` — "Start with what you're making." (product promise, one H1 owned by the page header).
2. `KretoTip` — contextual, unchanged.
3. **`StudioCreateHero`** — eyebrow, promise, explanation, canonical **Create a Project** CTA + "Describe it out loud", real project counts, and a 3-item product proof strip (Brief · Work · Wrap).
4. **`StudioProjectsDashboard`** — summary strip (In progress · Needs an invoice · Awaiting payment · Delivered) that doubles as a filter, plus search, sort and one prioritized compact list.
5. `StudioFoldersBar` — unchanged filing model; inside a folder the existing `StudioCardsGrid` detail view is preserved.
6. Session & Activity, Casting & Collaborators — unchanged.

Removed: the mic pill + bespoke creation block + the duplicate carousel/grid pair (the card wall).

## State B — Project detail (`/desk/:id`)
Unchanged in this pass. `StudioRoom` already implements header + presence + NextStepCard + scroll-native work feed + `⊕` deep tools through `WorkflowShell`. No regression was introduced; a detail-page dashboard pass is the next increment.

## Progressive disclosure
Money tiles disappear entirely when the viewer may not see money. Filters collapse the list rather than adding new panels. No metric gets its own decorative card.
