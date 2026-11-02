# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## A. Explicit redirects detected in the initial route inventory (1 November)

The extractor classified **41** entries as `REDIRECT → ...` from route JSX. These are historical declaration-level results, not tests of runtime navigation.

| # | Source route | Target |
|---:|---|---|
| 1 | `/unboarding` | `/onboarding` |
| 2 | `/circles` | `/crews` |
| 3 | `/profile/edit` | `/profile?edit=true` |
| 4 | `/dashboard` | `/` |
| 5 | `/my-analytics` | `/profile` |
| 6 | `/guide` | `/` |
| 7 | `/desk/projects` | `/desk` |
| 8 | `/wallet` | `/thrivepay` |
| 9 | `/purchases` | `/thrivepay` |
| 10 | `/accounting` | `/thrivepay?tab=earnings` |
| 11 | `/thrivemoney` | `/thrivepay?tab=earnings` |
| 12 | `/agent` | `/circle` |
| 13 | `/thrive-ai` | `/circle` |
| 14 | `/challenges` | `/` |
| 15 | `/challenges/:id` | `/` |
| 16 | `/market` | `/opportunities` |
| 17 | `/market/:listingId` | `/opportunities` |
| 18 | `/checkin` | `/` |
| 19 | `/events` | `/meetup` |
| 20 | `/explore` | `/nearby` |
| 21 | `/magazine` | `/spotlight?tab=magazine` |
| 22 | `/podcast` | `/spotlight?tab=podcast` |
| 23 | `/analytics` | `/admin` |
| 24 | `/admin-broadcast` | `/admin` |
| 25 | `/waitlist-admin` | `/admin` |
| 26 | `/test-emails` | `/admin` |
| 27 | `/feedback-admin` | `/admin` |
| 28 | `/deck` | `/` |
| 29 | `/partner-directory` | `/` |
| 30 | `/partner-submit` | `/` |
| 31 | `/rewards` | `/` |
| 32 | `/rewards-shop` | `/` |
| 33 | `/credits/mine` | `/credits` |
| 34 | `/credits/hub` | `/credits` |
| 35 | `/credits/discover` | `/search` |
| 36 | `/directory` | `/search` |
| 37 | `/sound-stages` | `/soundstages` |
| 38 | `/meetups` | `/meetup` |
| 39 | `/spark` | `/` |
| 40 | `/cre8` | `/` |
| 41 | `/marketplace` | `/opportunities` |

## B. Later heuristic scan (2 November) — not authoritative

A later script searched up to 280 characters following each `<Route ... path>` declaration, then looked for a nearby `<Navigate to>`. It emitted **75 potential redirect pairs**. This method can assign a redirect from a following route to the wrong route.

Examples of **unreliable apparent self-redirects** from that scan: `/credits → /credits`, `/desk → /desk`, `/thrivepay → /thrivepay`, `/soundstages → /soundstages`, `/meetup → /meetup`. Likewise `/discover → /soundstages` was reported by this heuristic but the historical exact inventory listed `/discover` as rendering `Discover`. Such results are **not confirmed redirect behavior**.

The scan's raw findings are retained below for traceability only, not as verified routing rules.

| # | Path | Heuristic target (unverified) |
|---:|---|---|
| 1 | `/founder-kit/metrics` | `/onboarding` |
| 2 | `/onboarding` | `/onboarding` |
| 3 | `/unboarding` | `/onboarding` |
| 4 | `/crew/:circleId/chat` | `/crews` |
| 5 | `/circles` | `/crews` |
| 6 | `/profile` | `/profile?edi` |
| 7 | `/profile/edit` | `/profile?edit=true` |
| 8 | `/dashboard` | `/` |
| 9 | `/settings` | `/profile` |
| 10 | `/settings/copilot-memory` | `/profile` |
| 11 | `/my-analytics` | `/profile` |
| 12 | `/desk` | `/desk` |
| 13 | `/desk/new-room` | `/desk` |
| 14 | `/desk/projects` | `/desk` |
| 15 | `/thrivepay` | `/thrivepay` |
| 16 | `/guest-pay` | `/thrivepay` |
| 17 | `/wallet` | `/thrivepay` |
| 18 | `/purchases` | `/thrivepay` |
| 19 | `/accounting` | `/thrivepay?tab=earnings` |
| 20 | `/thrivemoney` | `/thrivepay?tab=earnings` |
| 21 | `/pay/invoice/:id` | `/circle` |
| 22 | `/pay/:slug` | `/circle` |
| 23 | `/agent` | `/circle` |
| 24 | `/rolodex` | `/circle` |
| 25 | `/outreach` | `/circle` |
| 26 | `/thrive-ai` | `/circle` |
| 27 | `/challenges` | `/` |
| 28 | `/challenges/:id` | `/` |
| 29 | `/market` | `/opportunities` |
| 30 | `/market/:listingId` | `/opportunities` |
| 31 | `/ambassadors` | `/` |
| 32 | `/ambassador` | `/` |
| 33 | `/checkin` | `/` |
| 34 | `/nearby` | `/meetup` |
| 35 | `/events/backstage` | `/meetup` |
| 36 | `/events` | `/meetup` |
| 37 | `/desk/:projectId/crew` | `/nearby` |
| 38 | `/scene` | `/nearby` |
| 39 | `/explore` | `/nearby` |
| 40 | `/magazine/:slug` | `/spotlight?tab=magazine` |
| 41 | `/magazine` | `/spotlight?tab=magazine` |
| 42 | `/podcast` | `/spotlight?tab=podcast` |
| 43 | `/admin/external` | `/admin` |
| 44 | `/admin/disputes` | `/admin` |
| 45 | `/analytics` | `/admin` |
| 46 | `/admin-broadcast` | `/admin` |
| 47 | `/waitlist-admin` | `/admin` |
| 48 | `/test-emails` | `/admin` |
| 49 | `/feedback-admin` | `/admin` |
| 50 | `/deck` | `/` |
| 51 | `/share/magazine/:slug` | `/` |
| 52 | `/share/fund/:slug` | `/` |
| 53 | `/partner-directory` | `/` |
| 54 | `/partner-submit` | `/` |
| 55 | `/talent-finder` | `/` |
| 56 | `/rewards` | `/` |
| 57 | `/rewards-shop` | `/` |
| 58 | `/credits` | `/credits` |
| 59 | `/credits/mine` | `/credits` |
| 60 | `/credits/hub` | `/credits` |
| 61 | `/credits/project/:projectId` | `/search` |
| 62 | `/credits/discover` | `/search` |
| 63 | `/verify-credit` | `/search` |
| 64 | `/search` | `/search` |
| 65 | `/directory` | `/search` |
| 66 | `/discover` | `/soundstages` |
| 67 | `/match` | `/soundstages` |
| 68 | `/soundstages` | `/soundstages` |
| 69 | `/sound-stages` | `/soundstages` |
| 70 | `/meetup` | `/meetup` |
| 71 | `/meetup/manage` | `/meetup` |
| 72 | `/meetups` | `/meetup` |
| 73 | `/spark` | `/` |
| 74 | `/cre8` | `/` |
| 75 | `/marketplace` | `/opportunities` |

## Redirect-related cautions

- In the initial inventory, `/talent-finder` was classified `ProtectedRoute`, **not** an explicit redirect. The later heuristic listed `/talent-finder → /`; this must be confirmed from complete route JSX before using it as an established fact.
- In the initial inventory, `/discover` rendered `Discover`, **not** an explicit redirect. The later heuristic association with `/soundstages` must be checked.
- In the initial inventory, `/guide` redirected to `/`, but the 2 November V2 check independently confirmed it was restored and TypeScript passed.
- Some older aliases correctly redirect to the current destinations, such as `/marketplace → /opportunities` and `/sound-stages → /soundstages` in the initial snapshot.

**Evidence:** initial full route inventory; `Pasted text(20261102-020523).txt` for the later heuristic.
