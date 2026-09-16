# KrePay · Today · Messages · Scout · Menu — Phase 1 Read-Only Audit

Branch: `feature/reliability-overhaul`. No files edited during this pass — audit only,
per the execution protocol. Waiting for explicit confirmation before Phase 2 editing.

## Baseline gate (before any edits)

- `npm run typecheck` — clean, zero errors.
- `npm run test` — 99/99 passing (10 test files), same suite as `feature/activation-priority-plan`.
- `npm run build` — clean (background run completed, exit 0).
- `npm run lint` (full repo) — **not a valid gate**, same as documented in
  `STUDIO_OVERHAUL_V2_IMPLEMENTATION_REPORT.md` §16: this repo carries a large
  pre-existing baseline of `@typescript-eslint/no-explicit-any` errors across
  files unrelated to this pass (mostly Edge Functions). Any file this pass
  touches will be linted individually against zero-new-errors, not against
  the full-repo count.
- Working tree: only `supabase/functions/mcp/index.ts` modified — the
  unrelated, persistent Lovable-tooling artifact this session's standing
  rule says never to touch or commit.
- 14 most recent commits are all either `"Changes"` (auto-committed, no
  message) or `"Fixed 8 of 10 monitoring findings"` — no in-flight work on
  this branch that the plan below would conflict with.

---

## 1. Exact files to change (pending your approval)

**KrePay bank connection (§2 of the spec)**
- `src/components/wallet/WalletAddBankSheet.tsx` — surface the Edge Function's real error body instead of the generic Supabase-JS wrapper message.
- `supabase/functions/wallet-add-bank/index.ts` — validate the existing Connect account's country against the submitted bank country before attaching; map Stripe/DB errors to the required error-code vocabulary; add an idempotency key; branch `account_holder_type` on the user's `profiles.account_type`.

**KrePay dashboard (§3)**
- `src/pages/ThrivePay.tsx` — header copy → "Kreto KrePay"; remove Top Up/Passport/Identity/Stamps/Hire Me/Scan from the main focus; restructure around Get Paid / Activity / Payouts & Fees.
- New: a unified dashboard component (e.g. `src/components/thrivepay/KrePayDashboard.tsx`) replacing the current stack of unrelated cards (`MoneyBrief`, `WeeklyMoneyInsights`, `KrePayAIInsights`, `FinancialSummaryPanel`) — reusing `recharts` per the existing `src/components/earnings/EarningsBreakdownChart.tsx` pattern (already a dependency, zero new bundle cost).
- `src/components/thrivepay/SnapReceiptFAB.tsx` — relocate the "Scan" FAB out of the main view.

**Today (§4–§8)**
- `src/components/home/UnifiedHome.tsx` — personalized greeting (both the `FeaturePageHeader` props at lines 493–499 **and** the duplicate `<h2>` in `ThrivePromptHero.tsx:323-333`, which must move in lockstep or the two will visibly disagree); consolidate the current ~20 cards into exactly three components (Focus / More from Today / Momentum); full-width container fix.
- `src/components/home/ThrivePromptHero.tsx` — greeting copy sync only.
- New: `TodayFocus`, `MoreFromToday`, `Momentum` components (or a justified reuse/rename of the existing `TodayThreeCards.tsx`, which already covers part of this ground — needs a closer look before deciding new-vs-refactor).

**Global container alignment (§8, §13)**
- `src/components/home/UnifiedHome.tsx` lines 500 & 620 — change `container mx-auto max-w-5xl px-4 sm:px-6` to match KrePay's canonical `mx-auto px-3 sm:px-4 max-w-7xl` exactly. No shared `PageContainer` component exists anywhere in `src/` today — worth creating one so this doesn't drift a third time, but that's a design decision, not assumed here.

**Messages (§9)**
- `src/pages/Messages.tsx` — give the Inbox column its own safe-area-aware bottom padding (matching `KretopiaBottomNav`'s real footprint) instead of relying on the shared, non-safe-area-aware `pb-20 lg:pb-24`; paint the reserved gutter to match the Inbox's `bg-card` instead of leaving it transparent.
- `src/pages/messages/ConversationListPanel.tsx` — apply the corrected padding/background.

**Scout (§10–§11)**
- `src/components/opportunity/ScoutedGigsSection.tsx`, `src/components/opportunity/ShortlistedGigs.tsx`, `src/components/circle/OpportunitiesFeed.tsx` — migrate from raw `useState`/`useEffect` fetches to `useQuery` against the app's existing `QueryClientProvider` (`src/App.tsx:181-185`), following `src/hooks/useClients.ts` as the template, keyed off `scouted_at`/`expires_at`/`last_run_at` (already in the schema).
- `supabase/functions/scout-gigs/index.ts` — replace the sequential-chunked `for` loop (lines 379-389) with full `Promise.allSettled` + per-source `AbortController` timeouts; fix the `created_at` column bug (line 338, `scouted_gigs` has no such column — should be `scouted_at`) that's silently defeating the free-tier weekly-scan cap.

**Menu (§12)**
- `src/components/Navbar.tsx` — redesign `MenuButton` (lines 563-586) and its container (lines 346-352) from a single-column stack of `h-12 w-full` rows into a responsive grid (`grid grid-cols-2 sm:grid-cols-3`, matching the pattern already used in `src/components/project/studio/StudioCardsGrid.tsx:116`).

**Reports (new files, §18)**
`KREPAY_BANK_CONNECTION_SECURITY_REPORT.md`, `KREPAY_DASHBOARD_DATA_CONTRACT.md`, `TODAY_PERSONALIZATION_AND_INTERACTION_REPORT.md`, `TODAY_COMPONENT_CONSOLIDATION_REPORT.md`, `GLOBAL_PAGE_CONTAINER_ALIGNMENT_REPORT.md`, `MESSAGES_INBOX_LAYOUT_FIX_REPORT.md`, `SCOUT_SCAN_PERFORMANCE_REPORT.md`, `MENU_MODAL_UX_REPORT.md`, `MULTI_FEATURE_SECURITY_REPORT.md`, `MULTI_FEATURE_RELEASE_GATE.md`.

## 2. Exact files protected — will not touch

- `supabase/functions/mcp/index.ts` — standing rule, unrelated Lovable-tooling artifact.
- `src/components/ui/cta-button.tsx` — reused as-is, not modified; explicitly documented as not for navbar buttons.
- `src/components/Navbar.tsx`'s top nav bar itself (the sticky header, not the Menu Sheet content) — spec says don't touch navbar UX/UI unless required; only the Sheet's internal grid layout changes.
- `get_own_payment_identifiers()` RPC and the column-lock on `profiles.stripe_account_id`/`stripe_customer_id` — confirmed correctly guards against direct-column leaks, no changes needed.
- `creator_payout_methods` / `creator_payouts` / `stripe_webhook_events` schemas and RLS — no changes proposed; current policies are correctly scoped (`auth.uid() = user_id`, service-role-only writes for payouts/webhooks).
- `wallet-payout/index.ts`'s idempotency-key pattern — this is the reference implementation `wallet-add-bank` should be brought in line with, not touched itself.
- `supabase/functions/create-connect-account/index.ts` — this is the legacy flow that creates country-less Express accounts (see root cause below). **Not modified this pass**: retroactively adding a `country` param would not fix already-created accounts, and reconciling the two parallel Connect-account systems (legacy `profiles.stripe_account_id` Express flow vs. new `creator_wallets.stripe_account_id` controller flow) is an architecture decision, not a bug fix — flagged in §20 below for your explicit call before any code touches it.

## 3. Current behavior (condensed from the five parallel audits — full detail in each agent's findings)

**KrePay**: two parallel, unreconciled Stripe Connect systems live on one page — the new "Kretopia Wallet" card (`ThriveWalletCard`, table `creator_wallets`) and the legacy "Payouts & Fees" tab (table `profiles.stripe_account_id`). Page currently mixes financial content with unrelated cross-nav (Passport/Identity/Stamps/Hire Me) and a receipt-scanning FAB.

**Today**: `UnifiedHome.tsx` renders ~23 distinct cards/sections top to bottom (not three), most already data-driven with their own loading/empty states, no shared `PageContainer`, greeting is static copy with no name interpolation, container width (`max-w-5xl`, `px-4 sm:px-6`) disagrees with KrePay's (`max-w-7xl`, `px-3 sm:px-4`).

**Messages**: Inbox and chat panel render correctly in isolation; the visible defect is a fixed, full-width, near-black (`bg-background` under a hardcoded `dark` theme) mobile bottom nav overlapping an unstyled, non-safe-area-aware padding gutter reserved by the page's outer container.

**Scout**: results list does a fresh, uncached fetch on every mount (no react-query despite it being configured app-wide and used elsewhere); "Scan Now" is a single blocking edge-function call that internally runs ~57 search queries through a sequential-await loop with no per-source timeout, then one more blocking AI-extraction call, then a sequential DB-upsert loop — nothing streams back until all of it finishes.

**Menu**: a single-column `Sheet` of `h-12 w-full` stacked buttons inside a `w-[85vw] sm:w-[400px]` panel — no grid, ~14-18 items long, scrollable. Items are hardcoded JSX (not a data array), gated only by local component state (no feature-flag system).

## 4. Root cause of each reported bug

**KrePay IBAN "non-2xx" error** — two compounding causes:
- **A (confirmed, explains the exact reported string)**: `WalletAddBankSheet.tsx:65-67` shows `e.message` from a thrown `FunctionsHttpError`, whose message is a *hardcoded literal* in `@supabase/functions-js` ("Edge Function returned a non-2xx status code") — the function's real error body sits unread in `error.context`.
- **B (most likely underlying trigger)**: `wallet-add-bank/index.ts:43-49` reuses any pre-existing `creator_wallets.stripe_account_id` without re-validating its country. A migration (`20260528125850_...sql:111-123`) backfilled this column from the legacy `profiles.stripe_account_id`, which was created by `create-connect-account/index.ts:111-123` with **no `country` parameter at all** (Stripe defaults to the platform's country, presumed US). Any user who ever touched the old "Set up payouts" flow, then tries to add a French IBAN through the new flow, has Stripe reject a `country: "FR"` external account against a US-country connected account — a 400-class error that `wallet-add-bank`'s catch-all (line 131-135) flattens into an undifferentiated 500.
- **C (plausible, unconfirmable statically)**: the platform's Stripe account may not have EU/cross-border recipient payouts enabled at all — a Dashboard-level setting, not visible from code.

**Messages black bar** — `KretopiaBottomNav.tsx:82-91` (`fixed bottom-0 left-0 right-0 z-50 bg-background`, near-black under the app's hardcoded dark theme) overlaps `Messages.tsx:196`'s outer `pb-20 lg:pb-24`, which (a) is not safe-area-aware (no `env(safe-area-inset-bottom)` term, unlike e.g. `ThriveDesk.tsx:153`) so its static clearance can be smaller than the nav's real device-dependent height, and (b) is unstyled/transparent rather than matched to the Inbox's `bg-card`, so the gutter reads as a continuation of the near-black nav. Traced to commit `e00cad18`, which widened this padding to fix an unrelated desktop composer/KretoLauncher overlap without accounting for its effect on the Inbox's mobile bottom clearance.

**Scout >2min Scan Now** — `scout-gigs/index.ts:379-389`: a `for` loop `await`s each 4-query `Promise.all` batch sequentially across up to ~57 queries (≈15 round trips), with zero per-source timeout/`AbortController` anywhere in the file, so one slow/dead source (a dead ATS or Instagram scrape) stalls its batch and every batch after it; followed by one more blocking, non-streamed AI-extraction call (line 392) and a sequential upsert loop (457-482). Nothing returns to the client until all of it finishes.

**Scout empty-on-load** — separate, simpler bug: `ScoutedGigsSection.tsx`/`ShortlistedGigs.tsx`/`OpportunitiesFeed.tsx` all use plain `useState`/`useEffect`, not the `useQuery` the app already has configured — no cache survives a remount, so every page visit shows a full skeleton before anything renders, even though the schema already has the freshness fields (`scouted_at`, `expires_at`, `last_run_at`) a cache-first pattern needs.

**Menu cramped boxes** — `MenuButton` (`Navbar.tsx:569-586`) hardcodes `h-12 w-full` on every item, stacked one per row inside a narrow, capped-width `SheetContent` (`w-[85vw] sm:w-[400px]`) — there was never a grid, just a long single column.

## 5. Database / payment impact

- **No production migrations required** for any of the five identified bugs. The KrePay fix is logic-only (validate country, map errors, add idempotency key) — no schema change. The Scout `created_at` bug is a query fix (use the existing `scouted_at` column), not a schema fix.
- **One architecture question deliberately not resolved this pass**: reconciling the two parallel Stripe Connect account systems (legacy country-less Express accounts vs. new controller-based Wallet accounts) is a real structural issue but changing it retroactively affects every already-onboarded user's live Connect account — this needs your explicit product/security call before any code touches `create-connect-account` or the backfill logic, not a decision to make unilaterally inside a bug-fix pass.
- No wallet balances, payout statuses, or connected-account ownership will be altered by the proposed fix — only the *validation* before an external-account attach, and *error mapping* on failure.

## 6. Security risk

- `wallet-add-bank/index.ts` has no idempotency key on either `stripe.accounts.create` or `createExternalAccount` (contrast `wallet-payout/index.ts:58-61`, which already does this correctly) — a double-submitted "Save bank account" click can create duplicate Connect accounts or duplicate external accounts. Fix is code-only, same pattern as the existing `wallet-payout` reference.
- `account_holder_type: "individual"` is hardcoded (`wallet-add-bank/index.ts:85`) with no branch for `profiles.account_type === "company"` — a data-integrity risk (wrong legal classification with Stripe), not a data-exposure risk.
- No raw IBAN/account number is ever persisted (`creator_payout_methods` stores only `last4`/`brand`/Stripe's own external-account ID) or logged (`wallet-add-bank`'s only error log is `err.message`, and Stripe redacts sensitive params from its own error messages by contract) — this invariant is already correct and must be preserved by any fix, not just "not broken."
- `Navbar.tsx:452-456` gates the Admin Panel menu item on a hardcoded user UUID string comparison — a pre-existing fragile pattern, not introduced by this pass, flagged for awareness but out of scope unless you want it addressed.
- No cross-user financial data leak found in any of the five areas audited — Today's `MoneyBrief` reuses the same role-scoped queries as KrePay itself; Scout/Messages have no financial data path at all.

## 7. Performance plan

- **Scout Scan Now**: replace the sequential-chunked loop with `Promise.allSettled` across all queries plus a per-source `AbortController` timeout (~8-10s), so one dead source degrades gracefully instead of serializing the whole scan; decouple the final AI-extraction call from blocking the entire response where feasible.
- **Scout results**: migrate the three fetch components to `useQuery` against the already-configured `QueryClientProvider` (`staleTime: 5min`, `gcTime: 10min` — `src/App.tsx:181-185`) — this alone gives instant cached-paint-then-revalidate with no new dependency.
- **KrePay dashboard chart**: reuse `recharts` (already a dependency, already used in `EarningsBreakdownChart.tsx`) — zero bundle-size impact, no new library evaluation needed.
- **Today**: reuse the existing `framer-motion` + `useReducedMotion()` hook (`src/hooks/useReducedMotion.ts`, used in ~48 files already) rather than inventing new motion primitives; consolidating ~20 cards into 3 components should aim to reduce round trips by combining queries where the underlying data overlaps, not just visually regroup the same N fetches.

## 8. Test plan

Add/update tests, matching the categories in spec §16 (KrePay bank fixture tests, Today personalization/consolidation, Messages layout-class assertions, Scout cache/partial-failure/timeout, Menu grid/keyboard/responsive, security/role-isolation) — full breakdown will be finalized per-component once Phase 2 scope is confirmed, since some of this (e.g. exact IBAN test fixtures) depends on decisions in §20 below. Existing 99/99 baseline must stay green throughout; each new test file gets the same per-file lint-clean bar used in the Studio pass, not the full-repo lint count.

## 9. Browser verification plan

Same seven breakpoints as the spec's §17 (375×667 through 1440×900), verified live via the in-app Browser pane, following the same per-feature numbered checklists in §17 of your prompt. As with the Studio pass, I will not fabricate a "verified" claim for anything I can't actually exercise — e.g., a real Stripe test-mode IBAN attach depends on whether this project's Stripe key is in test mode and whether a France-country test fixture is reachable; I'll confirm that access before claiming it live-verified rather than assuming it.

## 10. Migration requirements

None for the five bugs as scoped. The only migration-shaped follow-up is the dual-Connect-account reconciliation flagged in §5/§20 — explicitly not proposed as part of this pass.

---

## Open product decisions (need your call before Phase 2 starts)

1. **Dual Stripe Connect systems**: fix `wallet-add-bank` to *detect and reject* a country mismatch against an existing (possibly legacy, country-less) Connect account with a clear actionable error — leaving the legacy account architecture itself untouched — or do you want to scope a full reconciliation (e.g., force re-onboarding through one canonical flow) as part of this pass? The former is a safe, contained bug fix; the latter is a bigger, riskier change to every existing connected user.
2. **Stripe test-mode verification**: can you confirm this project's Stripe secret key is in test mode, and whether a France-country test fixture/account is available? This determines whether §17's "test the French IBAN path" step is something I can actually exercise live versus something I'll have to mark not-live-testable, same as the Drop Zone gap from the Studio pass.
3. **Today's three-component consolidation**: `TodayThreeCards.tsx` already exists and covers part of this ground (approvals/overdue tasks/top gig/invoices). Do you want Focus/More-from-Today/Momentum built as a genuine consolidation of all ~20 current cards into exactly three, or do you consider `TodayThreeCards` + a wrapped "More from Today" already close enough that this is more of a rename/regroup than a rebuild? This changes the size of the Today portion of the work substantially.
4. **Global `PageContainer`**: no shared container component exists today — every page hand-rolls its own wrapper. Fixing Today to match KrePay's margins is a small, contained change either way, but do you want a shared `PageContainer` component created now (so Messages/Scout/Menu/Studio can't drift again later), or just a direct class match on Today for this pass?

Waiting for your explicit confirmation (and answers to the above) before any Phase 2 editing begins.
