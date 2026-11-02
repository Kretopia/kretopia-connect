# Kretopia Connect — Routing Reports

**Audit date:** 2 November 2026

**Project:** `kretopia-connect-main`

**Scope:** local React/Vite app, route and public-navigation reviews

**Evidence:** user-provided Terminal outputs from 1–2 November 2026.


> These are source-based audit reports, not production runtime tests. Historical snapshots are marked as such. No Git commit, remote push, backend update, or deployment was performed in preparing these reports.

## Chronology

| Date | Inspection / intervention | Evidence / confirmed result |
|---|---|---|
| 1 Nov 2026 | Complete `src/pages` / `src/App.tsx` inventory | 159 files; 180 JSX routes; 53 `ProtectedRoute`; 41 explicit redirects; 2 additional routing files |
| 1 Nov 2026 | Candidate unused-page screening | Preliminary 42 names; 38 actually inspected in direct-import audit; 22 with imports, 16 without |
| 2 Nov 2026 | Legacy pages archived (V3) | Six named `.tsx` files absent from source and present under `.local-backups/legacy-pages-v3/20261102-063832-189722` |
| 2 Nov 2026 | Guide V2 repair | `/guide` reactivated, content updated; 10/10 checks; 7/7 base destinations declared; TypeScript PASS |
| 2 Nov 2026 | Guest navbar V2 | Product / For Creatives / For Companies / Explore, two dropdowns; TypeScript PASS |
| 2 Nov 2026 | Guest navbar Unified | Platform / For Creatives / For Companies / Discover, two dropdowns; TypeScript PASS |
| 2 Nov 2026 | Final simple guest navbar | Platform / For Creatives / For Companies / Discover — **four direct links without dropdowns**, confirmed from later Terminal navigation audit |
| 2 Nov 2026 | Landing route tree scan | 180 route declarations, 65 scanned landing-related files, 75 heuristic redirect pairs; no source changes during audit |

## Current confirmed public navigation at time of last audit

```text
/landing
├── Platform        -> /guide
├── For Creatives   -> /passport
├── For Companies   -> /talent-finder
└── Discover        -> /discover

Right-side actions:
├── Search        -> opens search UI
├── Theme         -> theme toggle
├── Sign in       -> /auth?tab=signin
└── Join Kretopia -> /auth?tab=signup
```

Logo + wordmark + BETA remain in the left slot. Four direct links are confirmed in `guestNavItems`; there was no detected dropdown renderer. The authenticated nav was not modified in this pass.

## Open issues (not resolved or runtime-tested)

1. **Four public links as meaningful user-facing destinations.** `For Creatives` and `For Companies` still point at existing functional routes, not dedicated marketing/onboarding landing pages.
2. **Company guest path:** `/talent-finder` was `ProtectedRoute` in the original inventory. Authentication and redirect behavior for signed-out visitors require direct validation.
3. **Discover guest path:** `/discover` was a `Discover` component in the original inventory. The later 280-character heuristic claiming redirect to `/soundstages` is not proof; inspect the full JSX and test route behavior.
4. **Guide messaging:** `/guide` now renders the Guide V2, but the fit between that guide and a high-level Platform landing needs UX review.
5. **Footer continuity:** general Footer contains `/about`; actual landing `EditorialFooter` has dynamic links and was not enumerated. Credits and Spotlight should remain findable; actual placement requires the render tree.
6. **Legacy links:** `/partner-directory` and `/partner-submit` were explicit root redirects in the initial snapshot while link references remained in components. `/membership` appeared in the landing candidate scan but not in the initial route inventory.
7. **Mobile/keyboard:** No end-to-end interaction test was captured for header/Guide across device sizes.
8. **Auth query params:** `next`, `tab`, `src`, `intent` flow behavior remains to be tested.
9. **Historical route data:** initial `180` declarations were confirmed in the later scan, but detailed classification as `41 redirects` and `53 protected` belongs to the 1 November snapshot; later code changes could alter individual rows.
10. **Assets:** user-provided landing screenshots showed broken logo/Kreto images in header and hero; separate from routing, and not resolved by these audits.

## Documentation and commit boundary

These Markdown files are documentation artifacts created from audited Terminal outputs. They were **not** committed to the Git repository, and they do **not** assert GitHub is synchronized with the user's Mac. The original `.local-backups` archive should not be assumed to be present in a clone.
