# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## Reports in this set

| File | Contents |
|---|---|
| `01_ROUTE_INVENTORY.md` | Complete historical listing of 180 route declarations and their extracted JSX classifications |
| `02_REDIRECTS_AND_ALIASES.md` | 41 confirmed redirect declarations in historical snapshot; 75 later heuristic matches, clearly separated |
| `03_LANDING_PUBLIC_NAVIGATION.md` | Current four-link guest navigation and identified landing CTAs, footer references, destination risks |
| `04_GUIDE_V2_ROUTE_VALIDATION.md` | Guide route restoration, seven link targets, 10/10 static checks and TypeScript result |
| `05_PAGE_DEPENDENCY_AND_ARCHIVE_AUDIT.md` | 159-file page inventory, direct-import audit, six locally archived legacy pages |
| `06_ROUTE_HISTORY_AND_OPEN_ISSUES.md` | Dated change log, current caveats, and unresolved navigation questions |

## Evidence hierarchy

1. **Historical route inventory (1 Nov):** exact route/component extraction from `App.tsx`; complete at the time, but predates restoration of `/guide` and archival changes.
2. **Later confirmed checks (2 Nov):** Guide V2 status, guest header config, TypeScript, and six archived files.
3. **Heuristic navigation search (2 Nov):** 75 possible redirects from a 280-character search window. This is **not** a validated list of redirects.

## Important distinction

**Declared route ≠ public accessibility ≠ verified behavior.** The audits do not demonstrate that the destination loads for a signed-out visitor, that redirect conditions run, or that a query parameter is understood. Do not treat static `ProtectedRoute` detection as a complete auth and access review.
