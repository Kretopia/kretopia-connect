# Studio Projects Naming Audit

## Rule
User-facing "Loose projects" → **Projects**. Backend identifiers untouched.

## Occurrences found (before)
| File | Type | Action |
|---|---|---|
| `src/pages/WorkHome.tsx:658` | `<h2>Loose projects</h2>` | replaced by the `Projects` dashboard heading |
| `src/pages/WorkHome.tsx:639` | code comment | reworded |
| `LooseProjectsCarousel.tsx` | heading/empty/loading/aria/dots labels ("loose", "Nothing loose right now") | component removed; replaced by `StudioProjectsDashboard` |

## Not renamed (deliberate)
- `projects` table, `studio_folder_id` column, `studio_folders` table.
- Routes `/desk`, `/desk/:id`; all existing deep links and share links.
- `invoicesByProject` map keys, analytics events, storage keys.
- No `loose_projects` identifier exists anywhere in the data model — the term was presentation-only, so no compatibility layer was needed.

## Verification
`rg -i "loose" src/` returns no user-facing string. Unit test `StudioProjectsDashboard.test.tsx` asserts the rendered text never contains "loose".
