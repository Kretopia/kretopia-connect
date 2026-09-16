---
name: Hardcoded Color Drift Audit
description: Files still using raw Tailwind color classes (bg-emerald-500, etc.) instead of semantic tokens — must be migrated to brand tokens (--signal-amber, --accent-pay, --signal-magenta) per Brand System v1.0.
type: constraint
---

# Hardcoded Color Drift — Audit & Migration

**Rule (Core):** NEVER use raw Tailwind color classes (`bg-emerald-500`, `text-amber-600`, etc.) in components. Use semantic tokens only.

**Brand mapping for status colors:**
- Success / Paid / Done / Approved / Confirmed → `bg-[hsl(var(--accent-pay))]` + `/0.15` tint (money green #1DB954)
- Warning / Review / Pending / Invoiced → `bg-[hsl(var(--signal-amber))]` + `/0.15` tint (#FFC72C)
- Alert / Unsent / Magenta accent → `bg-[hsl(var(--signal-magenta))]` (#FF0A78)
- Error / Destructive → `bg-destructive` (existing semantic)

## Already migrated
- `src/pages/ProjectsList.tsx` — PAY_CHIPS dots
- `src/components/project/tasks/taskUtils.ts` — STATUSES + PRIORITIES

## Still violating (hit-list, by visibility)
High visibility (daily Desk surfaces):
- `src/components/project/today/TodayActivityFeed.tsx` L111-112
- `src/components/project/studio/ContentStudioSection.tsx` L64-77, L309
- `src/components/project/studio/CampaignStudioSection.tsx` L56-63, L266, L373
- `src/components/project/studio/EventSponsorsKanban.tsx` L33-35
- `src/components/project/studio/EpisodeDetailDialog.tsx` L42-44

Medium visibility:
- `src/components/project/workflow/RollCallTab.tsx` L22
- `src/components/project/workflow/RevisionsTab.tsx` L20-23
- `src/components/project/contracts/ContractsList.tsx` L21-22, L173, L177
- `src/components/project/contracts/ContractViewer.tsx` L133-160
- `src/components/project/expense/AIFinanceInsights.tsx` L25
- `src/components/project/PaymentVerification.tsx` L113

Low visibility / dead code candidates:
- `src/components/project/TaskCalendar.tsx`
- `src/components/project/SimpleProgressTracker.tsx`
- `src/components/project/WorkspaceSidebar.tsx`

## Approach
Chip away in order of visibility. When touching a file for any reason, migrate its colors at the same time.
