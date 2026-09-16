# Studio Dashboard — Data Contract

All metrics derive from two queries already issued by `/desk`. No new endpoint, no estimation, no invented "health score".

| Metric | Source | Calculation | Refresh | Role visibility | Empty | Failure |
|---|---|---|---|---|---|---|
| In progress | `projects` (RLS) | `status ∉ {completed, archived}` | on `fetchProjects()` | all viewers | `0` tile | error panel + Try again |
| Delivered | `projects` | `status ∈ {completed, archived}` | idem | all | `0` | idem |
| Needs an invoice | `projects` + `invoices` | delivered AND pay state `unsent` | idem | money-authorized only | `0` | idem |
| Awaiting payment | `invoices` | any invoice `status ≠ paid` for the project | idem | money-authorized only | `0` | idem |
| Pay dot / label | `invoicesByProject` | `paid > invoiced > unsent` | idem | money-authorized only | `No invoice` | dot hidden |
| Last activity | `projects.updated_at` | `formatDistanceToNowStrict` | idem | all | — | row still renders |
| Next action | `projects.status` + pay state | planning→add tasks · wrapping→wrap · active→open feed · delivered→invoice/chase/credits | idem | money wording only for authorized viewers | — | falls back to "Open the work feed" |

States: `loading` (spinner + "Loading your Projects…"), `error` (role=alert + retry), `empty` (creation-led), `filtered-empty` (Clear filters).

Performance: zero additional fetches. Filtering, search and sort are `useMemo` over already-loaded rows; the removed carousel/grid duplication cut one render path.
