# Kretopia Analytics Dashboard Plan v1.0
**Status:** Proposed · **Owner:** Data + Admin UI · **Date:** 2026-06-22 · **Phase:** 2 / Stabilize

Single admin surface at `/admin/analytics` rendering everything defined in `ACTIVATION_MODEL.md`, `FUNNELS.md`, and `ANALYTICS_EVENT_TAXONOMY.md`. Replaces the scattered metrics tiles currently in `SiteAnalyticsDashboard.tsx`, `deckMetrics.ts`, and ad-hoc admin pages.

---

## 1. Layout (single page, 6 sections)

```
┌────────────────────────────────────────────────────────────┐
│  Header: Date range · Persona filter · Export CSV          │
├────────────────────────────────────────────────────────────┤
│  Section 1 — North Star                                    │
│  [DAU] [WAU] [MAU] [Activation Rate] [D30 Retention]       │
├────────────────────────────────────────────────────────────┤
│  Section 2 — Activation                                    │
│  Activation funnel · Days-to-activate histogram            │
├────────────────────────────────────────────────────────────┤
│  Section 3 — Retention                                     │
│  D1/D7/D30 cohort heatmap · Persona breakdown              │
├────────────────────────────────────────────────────────────┤
│  Section 4 — Feature Adoption                              │
│  Adoption % per feature · Top features by DAU              │
├────────────────────────────────────────────────────────────┤
│  Section 5 — Funnels                                       │
│  Passport · Studio · Scout · Sound Stages (tabs)           │
├────────────────────────────────────────────────────────────┤
│  Section 6 — Persona Health                                │
│  Creator · Recruiter / Brand · Community host tiles        │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Section detail

### 2.1 North Star tiles

| Tile | Definition | SQL source |
|---|---|---|
| **DAU** | `COUNT DISTINCT user_id` in `analytics_events` last 24h | view `metric_dau_daily` |
| **WAU** | last 7d | `metric_wau_daily` |
| **MAU** | last 30d | `metric_mau_daily` |
| **Activation Rate** | activated / signed_up in last 30d cohort | `user_activation_status` |
| **D30 Retention** | % of cohort active in day 30 | `user_retention_cohorts` |

Each tile shows current value, ∆ vs previous period, and a 30-day sparkline.

### 2.2 Activation

- Horizontal funnel from `FUNNELS.md` §1.
- Histogram: days-to-activate (1, 2, 3, 4–7, 8–30, never).
- Two large numbers: median days-to-activate, % never-activated.

### 2.3 Retention (the cohort grid)

```
Signup week    Users   D1   D7   D14  D30  D60  D90
2026-W18       142    63%  41%  32%  27%  22%  19%
2026-W19       189    68%  44%  35%  29%  24%   -
...
```

- Triangular heatmap (darker = better retention).
- Toggle: Creator / Brand / Recruiter / Community / All.
- Toggle: returning = signed in vs returning = fired any event.

Backed by:

```sql
CREATE TABLE public.user_retention_cohorts (
  cohort_week  date    not null,
  persona      text    not null,
  day_offset   int     not null,  -- 1, 7, 14, 30, 60, 90
  retained     int     not null,
  cohort_size  int     not null,
  computed_at  timestamptz not null default now(),
  primary key (cohort_week, persona, day_offset)
);
```

Refreshed nightly by `compute-retention-cohorts` cron edge fn.

### 2.4 Feature Adoption

A table of every category from the taxonomy:

| Feature (category) | 30d users | % of MAU | Power users (≥10x) | ∆ 30d |
|---|---|---|---|---|
| Passport | 1,200 | 88% | 240 | +6% |
| Credits | 980 | 72% | 110 | +12% |
| Studio | 410 | 30% | 92 | +18% |
| Scout | 720 | 53% | 88 | +4% |
| SoundStages | 145 | 11% | 22 | new |
| Pay | 88 | 6% | 14 | +20% |
| ExecutiveProducer | 320 | 23% | 45 | +30% |
| DocumentGen | 95 | 7% | 18 | new |
| Voice | 60 | 4% | 8 | new |

### 2.5 Funnels

Tabbed view of the 4 (5) funnels from `FUNNELS.md`. Each tab:

- Stacked horizontal bars (step counts).
- Conversion % between steps with arrows.
- 30-day trend per step.
- "Drop-off diagnostic" — top 5 reasons users stuck at each step (from event properties, e.g., Studio funnel: stuck at "Add Collaborator" because `workspace_type='general'` and owner is solo).

### 2.6 Persona Health

Three side-by-side cards:

**Creator Health**
- Active Creators (made any value-add event last 7d): `N`
- Avg Stamps per active Creator: `X`
- % with ≥ 1 Co-sign: `Y%`
- Top blocker (most common funnel drop): `step`

**Recruiter / Brand Health**
- Active Recruiters last 7d
- Avg Passports viewed
- Avg outreach sent
- Reply rate

**Community Health**
- Live Circles last 7d
- Sound Stages opened
- Events with ≥ 5 RSVPs
- Average attendees per stage

---

## 3. Implementation plan

### 3.1 New tables / views

| Object | Purpose |
|---|---|
| `analytics_events` (already exists) | extend w/ Zod-validated writer |
| `user_activation_status` view | from `ACTIVATION_MODEL.md` |
| `user_retention_cohorts` table | nightly cron |
| `analytics_funnel_progress` table | per-user per-funnel step state |
| `metric_dau_daily` mat. view | refresh hourly |
| `metric_wau_daily` mat. view | refresh hourly |
| `metric_mau_daily` mat. view | refresh hourly |
| `metric_feature_adoption_30d` mat. view | refresh hourly |

### 3.2 New edge functions

| Function | Schedule | Purpose |
|---|---|---|
| `compute-retention-cohorts` | nightly 02:00 UTC | Populates `user_retention_cohorts` |
| `refresh-analytics-views` | hourly | `REFRESH MATERIALIZED VIEW CONCURRENTLY ...` |
| (no new public/user endpoints — admin reads via Supabase client + RLS) | | |

### 3.3 Client work

- `src/lib/analytics.ts` — single writer:
  ```ts
  trackEvent(name: EventName, properties: PropertiesFor<typeof name>)
  ```
  Typed by the union of event names from the taxonomy. Validates with Zod, posts to `analytics_events`.
- `src/pages/admin/Analytics.tsx` — the dashboard.
- Components co-located in `src/components/admin/analytics/`:
  - `NorthStarTiles.tsx`
  - `ActivationFunnel.tsx`
  - `RetentionHeatmap.tsx`
  - `FeatureAdoptionTable.tsx`
  - `FunnelTabs.tsx`
  - `PersonaHealthCards.tsx`

### 3.4 Auth

- Page guarded by `has_role(auth.uid(), 'admin')`.
- All queries through `useUserRole` check; no service-role keys client-side.
- Analytics-internal emails excluded per [Analytics Exclusions] memory.

---

## 4. Performance budget

- Page must load in **< 2s p50** with 6 months of data.
- All tiles backed by materialized views → max 50 ms each.
- Cohort heatmap is pre-computed nightly → instant.
- Funnel queries use `analytics_funnel_progress` (denormalized) → max 200 ms.

---

## 5. Out of scope

- Real-time websocket updates (dashboard refreshes on tab focus).
- Self-serve query / custom dashboards.
- Per-user drill-down ("show me everything user X did").
- Mobile responsive — admin-only, desktop assumed.

---

## 6. Build order (within Phase 2)

1. Day 7: ship `analytics_events` Zod writer + first 10 events instrumented.
2. Day 8: ship `user_activation_status` view + activation tile.
3. Day 9: ship retention cohort cron + heatmap.
4. Day 10: ship 4 funnels.
5. Day 11: ship persona health cards, feature adoption, North Star tiles. Done.

Output of Phase 2 = `ANALYTICS_BASELINE_2026.md` with the first real numbers from the dashboard.
