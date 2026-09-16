# Kretopia — Release Readiness Baseline (Phase 0)

Generated: 2026-08-16 · Branch: `edit/edt-a792c43b` (not `main`) · Head: `7463e05a`
Scope: read-only inspection + safe non-destructive fixes. No migrations, no RLS changes, no secret rotation, no production config changes.

Legend: **[PASS]** verified · **[PARTIAL]** exists, incomplete · **[FAIL]** broken · **[MISSING]** not implemented · **[BLOCKED]** needs credentials/approval · **[DEFERRED]** not needed for beta

---

## 1. Build & quality gates

| Item | State | Evidence | Severity | Next action |
|---|---|---|---|---|
| `npm run typecheck` | [PASS] | `tsc --noEmit -p tsconfig.app.json` → exit 0 | — | keep in CI |
| `npm run test` | [PASS] | vitest: 5 files / 62 tests passed | — | coverage is thin (5 lib units only) — see §5 |
| `npm run build` | [PASS] | vite build ok in ~45s, PWA precache 321 entries | — | main chunk `index-*.js` = 1.92 MB (580 kB gzip) → code-split |
| `npm run lint` | [FAIL] | 3450 problems (3147 errors / 303 warnings) | medium | see breakdown below |
| Bundle budget | [PARTIAL] | single 1.9 MB entry chunk | medium | manualChunks for daily-js, framer-motion, recharts |

Lint breakdown (top rules):

| Rule | Count | Assessment |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | 2897 | style debt, non-blocking |
| `react-hooks/exhaustive-deps` | 230 | risk of stale closures, audit per-surface |
| `no-empty` | 85 | mostly empty `catch {}` — acceptable pattern here |
| `no-useless-escape` | 76 | cosmetic |
| `react-refresh/only-export-components` | 58 | dev-only |
| `react-hooks/rules-of-hooks` | **7 → 0** | **real bugs, fixed this pass** (see §4) |

## 2. Application surface

| Item | State | Evidence |
|---|---|---|
| Routes registered | [PASS] | 174 `path=` entries in `src/App.tsx` |
| `/search` results route | [PASS] | restored previously; `SearchResults.tsx` seeds `SearchV2` from `?q=` |
| Edge functions | [PASS] | 310 functions under `supabase/functions/` |
| Supabase client | [PASS] | `src/integrations/supabase/client.ts`, publishable key only |
| Frontend env vars | [PASS] | only `VITE_SENTRY_DSN`, `VITE_SITE_URL`, `VITE_SUPABASE_{URL,PROJECT_ID,PUBLISHABLE_KEY}`, `VITE_VAPID_PUBLIC_KEY` — no service-role, no private keys (`rg SERVICE_ROLE src` → 0 hits) |
| Monitoring | [PASS] | Sentry initialised in `src/main.tsx`, prod-only, traces 1.0 / replay 0.1 |
| Client error logging | [PASS] | `setupGlobalErrorLogging()` → `client_error_logs` |
| Service worker hygiene | [PASS] | SW unregistered in iframe/preview, cleared for non-PWA browsers |

## 3. Core loop — component-existence vs verified

Component existence is **not** verification. Status below is "code present and typechecks", except where marked.

| Loop step | Code present | Runtime-verified |
|---|---|---|
| Search | [PASS] `/search`, `UnifiedSearchDropdown`, `SearchV2` | [PARTIAL] route restored + build verified; no E2E run |
| Claim Passport | [PASS] `UniversalClaimFlow` (search → disambiguate → verify → preview → face → email) | [MISSING] not executed end-to-end this pass |
| Confirm credits | [PASS] `credits` + `discovered_credits` via `fetchCreativeRecord` | [MISSING] |
| Co-Sign | [PASS] `CreditVerify.tsx`, token guest flow, `CreditEndorsementDialog` | [MISSING] |
| Scout / Opportunity | [PASS] `scouted_gigs`, `scout-gigs`, `surface-agent-watch` (columns fixed) | [PARTIAL] column fix deployed, awaiting clean log window |
| Apply / Hire | [PASS] `PostOpportunity.tsx`, applicant flows | [MISSING] |
| Studio | [PASS] `ProjectsList` / `StudioRoom` | [MISSING] |
| Milestone | [PASS] `milestones`, `create-milestone-payment`, `capture-milestone-payment` | [MISSING] |
| Payment | [PASS] Stripe + wallet functions | [BLOCKED] sandbox run needs test credentials/approval |
| Review → stronger Passport | [PARTIAL] `review_requests` exists; RLS gap open (see security gate) | [MISSING] |

## 4. Fixed in this pass (safe, non-destructive)

1. `src/components/nav/KretopiaBottomNav.tsx` — hooks were called after an early `return null` on `/auth`. Hook order could change between renders (React crash risk on route change). Early returns moved below all hooks.
2. `src/pages/ProjectsList.tsx` — two `useMemo` calls sat after the `if (loading) return <skeleton/>` branch. Same class of bug; loading branch moved after the memos.
3. `src/components/inbox/HotLeadsStrip.tsx` — local helper misnamed `useDraft` (read by React as a hook inside a callback). Renamed `applyDraft`.
4. `supabase/functions/telegram-setup-webhook` + `telegram-status` — were `verify_jwt = false` with **no** authorization at all; anyone could re-register the bot webhook or read bot/webhook diagnostics. Both now call `requireAdminOrCron`. Deployed.
5. `supabase/functions/invoice-pay-info` — public endpoint returned `recipient_email`. Removed from the payload; `create-invoice-checkout` already resolves the email server-side, so `src/pages/PayInvoice.tsx` no longer forwards it. Deployed.

Post-fix: typecheck exit 0, `rules-of-hooks` errors 7 → 0.

## 5. Gaps that block a confident beta claim

| Gap | Severity | Owner | Next action |
|---|---|---|---|
| 2 open RLS findings (see `SECURITY_RELEASE_GATE.md`) | high | backend | needs migration approval — **not applied** per instructions |
| No E2E test of the core loop | high | product/QA | execute `PRIVATE_BETA_EXIT_CHECKLIST.md` with a real test account |
| Test suite covers only 5 lib modules | medium | eng | add tests for claim flow reducer, credit evidence, match scoring |
| 1.9 MB entry chunk | medium | eng | `manualChunks`, lazy-load Daily/Remotion/recharts |
| 230 exhaustive-deps warnings | medium | eng | triage on Passport/Studio/Scout surfaces first |
| Email domain/SPF/DKIM state | [BLOCKED] | ops | verify provider before any sender change (do **not** switch to `info@kretopia.com` in code) |
| Payments sandbox run | [BLOCKED] | ops | needs sandbox keys + explicit go-ahead |

## 6. Release recommendation

**Do not declare Private Beta ready.** Build, types and unit tests are green and the two unauthenticated Telegram endpoints plus an invoice PII leak are now closed, but the core loop has not been executed end-to-end and two RLS findings remain open pending migration approval.
