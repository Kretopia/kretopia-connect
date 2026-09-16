# KrePay Dashboard — Data Contract

`src/components/thrivepay/KrePayDashboard.tsx` — the single unified
dashboard required by the overhaul spec §3. Every metric below: source,
calculation, role visibility, loading/empty/error, refresh behavior.

## Design decision: no wallet-balance duplication

This dashboard deliberately does **not** show "Available to cash out" —
`ThriveWalletCard` (rendered directly below it on `/thrivepay`) already
owns that number prominently. An earlier draft of this component repeated
it in its own header; removed once the redundancy was obvious, per the
spec's explicit "avoid redundant metrics." This dashboard's job is money
**flow** (in/out/owed/trend over time), not point-in-time balance.

## Metrics

| Tile | Source | Calculation |
|---|---|---|
| In this month | `invoices` where `issued_by = auth.uid()` | Sum of `total_amount ?? amount` where `status = "paid"` and `paid_at` falls in the current calendar month |
| Out this month | `expenses` where `user_id = auth.uid()` | Sum of `amount` where `date` falls in the current calendar month |
| Owed to you | `invoices` where `issued_by = auth.uid()` | Sum of `total_amount ?? amount` where `status` is neither `paid` nor `cancelled`; a row additionally counts toward the "N overdue" subtitle when its `due_date` is in the past |
| Net this month | derived | `In this month − Out this month` |

Chart series (income/outgoing over the selected range) use the identical
row-level filters as the tiles above, bucketed by day (7d range) or week
(30d/90d ranges) instead of collapsed to one number — same source, same
definition of "income" and "outgoing," just grouped over time.

"Your week, in money" insights (earned this week / overdue count / top
expense category / invoices sent this week) — same calculation
`WeeklyMoneyInsights.tsx` used before this component replaced it, always
computed for the current calendar week regardless of the chart's selected
range.

## Role visibility

All queries filter by `auth.uid()` via Supabase RLS (`issued_by = auth.uid()`
on invoices, `user_id = auth.uid()` on expenses) — a user only ever sees
their own invoices and expenses. This dashboard does not currently branch
on account role (client/collaborator/admin) because it only ever queries
rows the signed-in user themselves created — there is no cross-user data
path to gate. (KrePay's separate client/collaborator money-visibility
gating for *milestone* data lives in the Studio role-based RLS work from
an earlier pass, not in this dashboard.)

## Loading / empty / error

- **Loading**: a single skeleton block while both queries are in flight.
- **Empty** (no invoices/expenses at all, or none in the selected chart
  range): tiles show `$0` (real zero, not hidden); the chart area shows an
  explicit "No money movement in this range yet" message instead of a
  blank chart.
- **Error** (either query throws): a plain-text error state with a retry
  action — no partial/misleading numbers are shown if the fetch failed.

## Refresh behavior

Fetches once on mount (and again if `user.id` changes, e.g. account
switch). No polling, no realtime subscription — matches the refresh
cadence of the components it replaced. The date-range and income/outgoing
filters are pure client-side state changes over already-fetched rows, so
switching them is instant with no new network request.

## Verified

- `npm run typecheck` — clean. `npm run test` — 99/99 passing.
  `npm run build` — clean, no new heavy dependency (recharts was already a
  project dependency, already used in `EarningsBreakdownChart.tsx`).
- **Live-verified in the browser**: header reads "Kreto KrePay."; the
  prominent "Top Up" CTA and the Passport/Identity/Stamps/Hire Me strip are
  gone from the main view; the date-range chips (7d/30d/90d) and
  income/outgoing filter chips are real state, confirmed via direct click
  (`aria-selected`/`aria-pressed` flipped correctly); the dashboard and
  `ThriveWalletCard` below it show the balance number exactly once, not
  twice; the Scan-receipt button, previously a page-wide floating button,
  now only appears while the Activity tab is active (confirmed by
  switching tabs and checking for `[data-snap-receipt-fab]` in the DOM);
  Top Up is reachable from the header's actions dropdown ("Wallet → Top
  Up"), same underlying `WalletTopUpDialog`, not deleted.

## Not independently verified

Accessibility of the chart for screen-reader users — the chart region has
an `aria-label` summarizing the totals, and the legend uses icon+text (not
color-only), but a screen reader was not run against it this session. The
7 required responsive breakpoints (375×667 through 1440×900) — only the
Browser pane's default viewport was exercised live.
