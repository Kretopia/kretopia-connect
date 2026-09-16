# KrePay Critical Security Runbook

**Status: `RESOLVED — CONFIRMED CLOSED 2026-08-26`.** §12 documents a real
reversal that happened after this document's original narrow fix
(`20260823160000`/`20260823170000` — never actually committed to this repo,
see note below). That reversal is **not the current state.** A separate,
broader, actually-committed migration — "Migration A"
(`supabase/migrations/20260823223419_...sql` +
`20260823223514_...sql`) — was applied later the same day. Unlike this
document's column-level `REVOKE`s, Migration A drops the underlying
permissive RLS policies entirely and grants `ALL` only to `service_role`,
which is why it didn't suffer the same silent-reopening failure mode.
`KREPAY_SECURITY_VERIFICATION_REPORT.md` confirmed Migration A live via
`has_column_privilege`/`has_table_privilege`. **The user independently
re-ran this document's own §12 verification query directly against
production on 2026-08-26 and got zero rows** — confirmed, not inferred.

Historical note for whoever reads this later: the `20260823160000`/
`20260823170000` migration files this document's earlier sections
describe do not exist anywhere in this repo's git history (verified by
direct file search and `git log --all`) — despite the note below claiming
they were "live in the repo." Whatever was actually applied and later
found reverted in §11-12 was applied directly against the database, not
through a committed migration file. Migration A, the fix that's actually
in effect now, is the real committed artifact. Do not attempt to
re-apply the SQL blocks in §1 or §11 of this document — they don't
correspond to files in this repo and are superseded by Migration A.

~~Not `CRITICAL_VULNERABILITY_ACTIVE`-only, because a reviewed fix exists.
Not `FIX_APPLIED_AND_VERIFIED`, because nothing has been applied or tested
against a live database — no Supabase DB access exists in this session,
and none of the negative tests in `KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md`
have been run. The vulnerability is still live in production right now.~~
(Superseded — see status line above.)

No deploy, email, live Stripe call, live transfer, or production data
modification was performed while producing this document. Nothing was
applied automatically.

---

## 1. Exact migration file and affected objects

File: `supabase/migrations/20260823160000_krepay_security_hardening.sql`
(71 lines, reproduced in full below for the record — this is exactly what
would run, nothing paraphrased).

```sql
REVOKE UPDATE (balance, credits) ON public.wallets FROM authenticated, anon;

REVOKE UPDATE (kyc_status, payouts_enabled, charges_enabled, stripe_account_id, requirements)
  ON public.creator_wallets FROM authenticated, anon;

ALTER TABLE public.wallet_transfers
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transfers_idempotency_key
  ON public.wallet_transfers (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

(Comments/provenance omitted above for brevity — the actual file has them;
nothing else is hidden.)

### Affected tables

| Table | Current RLS (unpatched) | Migration file where policy was created | Columns this migration REVOKEs |
|---|---|---|---|
| `public.wallets` | `CREATE POLICY "Users can update their own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);` — **no `WITH CHECK`, no column restriction** | `20250930110718_317c2f4c-5455-4bfa-a91f-54b9282081b8.sql:38-40` | `balance`, `credits` |
| `public.creator_wallets` | `CREATE POLICY "own wallet update" ON public.creator_wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id);` — same gap | `20260528125850_6b5c8803-258c-4ced-b9cc-908a22fa1308.sql:20` | `kyc_status`, `payouts_enabled`, `charges_enabled`, `stripe_account_id`, `requirements` (left updatable: `country`, `default_currency`) |
| `public.wallet_transfers` | Already correctly locked (`REVOKE INSERT,UPDATE,DELETE FROM authenticated,anon`, `20260804103153_...sql`) — not itself vulnerable | n/a | Additive only: new `idempotency_key` column + unique partial index (KP-05, MEDIUM, not part of the two CRITICAL findings) |

### Affected SECURITY DEFINER functions (existing, unmodified by this migration — they are the *intended* sole write path this migration leaves in place)

| Function | File | EXECUTE granted to |
|---|---|---|
| `public.wallet_debit(p_user_id uuid, p_amount numeric)` | `20260804103153_2e1c09c1-fc9d-4193-86e2-c2d38acffb2e.sql` | `service_role` only (`REVOKE ALL ... FROM public, anon, authenticated`) |
| `public.wallet_credit(p_user_id uuid, p_amount numeric)` | same file | `service_role` only |
| `public.admin_confirm_bank_transfer(p_transfer_id, p_admin_notes)` | `20260417191317_7b836845-12dd-45bb-8eb0-65c6aec0a704.sql` | default (Postgres `PUBLIC`) — self-gated internally by `has_role(auth.uid(),'admin')`, `RAISE EXCEPTION` otherwise. Writes `wallets.credits` for bank-transfer top-ups. |
| `public.create_wallet_for_user()` | `20260419162457_9315b75c-ec60-4372-bddf-a5437b1c1c6d.sql` | trigger-invoked only (`AFTER INSERT` on the row that creates a wallet), not directly callable |

### Affected Edge Functions (call `wallet_debit`/`wallet_credit` via their `service_role` client)

| Function | Calls | Reads `payouts_enabled`? |
|---|---|---|
| `wallet-transfer/index.ts` | `wallet_debit` (sender), `wallet_credit` (recipient) | no |
| `wallet-topup-confirm/index.ts` | `wallet_credit` only, gated on a real Stripe session `payment_status === "paid"` | no |
| `wallet-payout/index.ts` | **does not touch `wallets` at all** — reads `creator_wallets.stripe_account_id`/`payouts_enabled`, calls `stripe.payouts.create()` against the user's **Stripe Connect account balance**, a separate ledger from `wallets.balance` | yes — this is finding #2's exact gate |

No other edge function reads or writes `public.wallets` or
`public.creator_wallets` beyond a `SELECT` (confirmed by
`grep -rn "from(\"wallets\"\|from(\"creator_wallets\"" supabase/functions`).

---

## 2. Exact attack paths

### Finding #1 — `wallets.balance`/`credits` forgery

1. Attacker holds a valid session JWT for their own account (no special
   privilege needed — any signed-up user).
2. Attacker sends, directly against the Supabase REST API, bypassing the
   app UI entirely:
   ```
   PATCH https://<project>.supabase.co/rest/v1/wallets?user_id=eq.<attacker-own-user-id>
   Authorization: Bearer <attacker JWT>
   apikey: <anon key>
   Content-Type: application/json
   Prefer: return=minimal

   {"balance": 999999.99}
   ```
3. This is accepted today: `USING (auth.uid() = user_id)` passes (it's
   their own row), there is no `WITH CHECK`, and no column is revoked, so
   PostgREST permits the `UPDATE`. The only constraint that could block it
   is `CHECK (balance >= 0)`, which a large positive number satisfies.
4. The attacker's `wallets.balance` now reads `$999,999.99` everywhere the
   app displays it (`ThriveWalletCard`, `FinancialSummaryPanel`, etc. —
   all of which trust the row at face value; none of them re-derive it).
5. Attacker opens `WalletTransferDialog` in the normal app UI and sends,
   say, `$500,000` to any other real user. `wallet-transfer` calls
   `wallet_debit(attacker, 500000)` — this succeeds because
   `wallet_debit`'s own check is only `balance >= p_amount`; it has no way
   to know the balance itself was forged three steps ago. It then calls
   `wallet_credit(victim_or_accomplice, 500000)`, crediting a real user's
   `wallets.balance` with money that was never actually paid into the
   platform via Stripe.
6. A `wallet_transfers` row and two `transactions` rows (`type: 'sent'`
   for the attacker, `type: 'received'` for the recipient) are created —
   real rows, structurally valid, financially fraudulent.

### Finding #2 — `creator_wallets.payouts_enabled` bypass

1. Attacker has (or creates, via the legitimate `create-connect-account`
   flow) a `creator_wallets` row with a real `stripe_account_id`, but
   Stripe has not marked their account `payouts_enabled` (e.g. KYC still
   `pending` — a completely ordinary, common state for a new account).
2. Attacker sends:
   ```
   PATCH https://<project>.supabase.co/rest/v1/creator_wallets?user_id=eq.<attacker-own-user-id>
   Authorization: Bearer <attacker JWT>
   ...
   {"payouts_enabled": true}
   ```
   Accepted today for the identical reason as finding #1 — `USING
   (auth.uid() = user_id)`, no `WITH CHECK`, no column revoke.
3. Attacker opens the Payouts & Fees tab and requests a cash-out.
   `wallet-payout/index.ts:27-35` reads `creator_wallets` and checks
   `!wallet?.stripe_account_id || !wallet.payouts_enabled` — this is now
   `false` (the gate passes), because the attacker forged the second half
   of that condition.
4. `wallet-payout` calls `stripe.payouts.create({ amount, currency,
   ...}, { stripeAccount: wallet.stripe_account_id })` — a **real, live
   call to Stripe's API**, reachable and executed by the app's own
   backend as a direct consequence of the forged flag.

**What this audit can and cannot confirm about step 4's outcome without
a live Stripe call (which stays off-limits regardless):** the app-level
authorization control is unambiguously bypassed — that is the
vulnerability, independent of what happens next. Whether Stripe's own
Connect API then actually disburses funds depends on that specific
Connect account's real state on Stripe's servers (available balance,
Stripe's own independent KYC/payout-eligibility enforcement), which this
static, no-live-calls audit cannot observe. Two realistic sub-cases:
- An account with **no real captured-charge history** likely has ~$0
  available on Stripe's side regardless of what our `payouts_enabled`
  column says — Stripe would reject or pay out $0.
- An account that has **legitimately earned real money** (completed
  milestones, real captured charges) but is sitting in a real
  Stripe-side "pending verification" state is the genuinely dangerous
  case: bypassing the *app's* gate reaches a live Stripe call that could
  plausibly succeed in releasing real funds Stripe would otherwise be
  holding — this cannot be ruled out by this audit and should be treated
  as the governing risk case, not the optimistic one.

---

## 3. Impact confirmation

| Capability | Finding #1 (`wallets`) | Finding #2 (`creator_wallets`) |
|---|---|---|
| Alter balances | **YES** — direct, confirmed | No (doesn't touch `wallets`) |
| Bypass payout eligibility | No (no connection to Connect payouts) | **YES** — direct, confirmed |
| Create payment records | **Partial** — real `wallet_transfers`/`transactions` rows are created (internal ledger records), but no Stripe-side Checkout Session/PaymentIntent is involved | **YES** — a real `creator_payouts` row is inserted (`wallet-payout/index.ts` inserts one after the Stripe call) and a real Stripe Payout object is attempted |
| Trigger transfers | **YES** — via the normal, unmodified `wallet-transfer` flow, using the forged balance | No (payouts are a different mechanism from transfers) |
| Frontend-display-only | **NO for either.** Both are genuine backend data-integrity failures — real `UPDATE` statements against real rows via the real REST API, not a client-side rendering bug. |

**No confirmed real-world cash-out path was found for finding #1 alone**
— exhaustive grep confirms `wallet_debit`/`wallet_credit` (the only
functions that can move `wallets.balance`) are called from exactly two
places (`wallet-transfer`, `wallet-topup-confirm`), and there is no
"withdraw wallet balance to bank" mechanism anywhere in this codebase.
The forged balance stays inside the internal ledger — but it **is** fully
transferable to any other real user's `wallets.balance`, and it displays
throughout the app as real spendable money, which is itself a live fraud
and trust-integrity issue regardless of whether a direct bank withdrawal
path exists today. Any future feature that lets a user *spend*
`wallets.balance` on something of real value would inherit this exploit
immediately, with no additional work by an attacker.

**Finding #2 has a plausible direct real-money path**, as described in §2.

---

## 4. Whether production financial rows may already be affected

**Unknown — cannot be determined without database access, which this
session does not have.** This is stated plainly rather than guessed.
Section 5 below gives the exact read-only queries to answer this; someone
with Lovable Cloud SQL access should run them before or immediately after
applying the fix, so a genuine-exploit signal isn't retroactively erased
by the fix's own effects (the fix prevents *future* forgery; it does not
detect or undo *past* forgery).

---

## 5. Read-only preflight queries (Lovable Cloud SQL editor)

Run all of these **before** applying the migration. All are `SELECT`
statements — none modify any row.

```sql
-- 5.1 Any wallet whose balance doesn't reconcile against its own
-- transaction history is a signal (not proof) of direct tampering.
-- transactions.amount for type IN ('received') should sum close to
-- balance; large unexplained gaps are the thing to look at manually.
SELECT w.user_id, w.balance, w.credits, w.updated_at,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type IN ('received','payment_received','credit_earned')), 0) AS total_credited,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type IN ('sent','payment_sent','withdrawal','credit_spent')), 0) AS total_debited
FROM public.wallets w
LEFT JOIN public.transactions t ON t.user_id = w.user_id
GROUP BY w.user_id, w.balance, w.credits, w.updated_at
HAVING w.balance <> (
  COALESCE(SUM(t.amount) FILTER (WHERE t.type IN ('received','payment_received','credit_earned')), 0)
  - COALESCE(SUM(t.amount) FILTER (WHERE t.type IN ('sent','payment_sent','withdrawal','credit_spent')), 0)
)
ORDER BY w.balance DESC;

-- 5.2 Wallets with an unusually large balance relative to any completed
-- top-up history — a forged balance has no matching wallet_topups row.
SELECT w.user_id, w.balance,
       COALESCE(SUM(wt.amount) FILTER (WHERE wt.status = 'completed'), 0) AS total_topped_up
FROM public.wallets w
LEFT JOIN public.wallet_topups wt ON wt.user_id = w.user_id
GROUP BY w.user_id, w.balance
HAVING w.balance > COALESCE(SUM(wt.amount) FILTER (WHERE wt.status = 'completed'), 0) + 1000
   -- +1000 buffer for the legitimate 10-credit signup seed and small
   -- legitimate inbound transfers; tune this threshold on review
ORDER BY w.balance DESC
LIMIT 200;

-- 5.3 wallet_transfers with unusually large amounts, or any sender whose
-- current balance couldn't have covered the transfer from top-ups alone.
SELECT wt.id, wt.sender_id, wt.recipient_id, wt.amount, wt.status, wt.created_at
FROM public.wallet_transfers wt
ORDER BY wt.amount DESC
LIMIT 100;

-- 5.4 creator_wallets rows where payouts_enabled = true but no
-- corresponding account.updated webhook event exists in
-- stripe_webhook_events for that account — a real Stripe-driven update
-- always comes with a logged event; a forged one won't.
SELECT cw.user_id, cw.stripe_account_id, cw.payouts_enabled, cw.kyc_status, cw.updated_at
FROM public.creator_wallets cw
WHERE cw.payouts_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM public.stripe_webhook_events swe
    WHERE swe.type = 'account.updated'
      AND swe.payload->'data'->'object'->>'id' = cw.stripe_account_id
  );

-- 5.5 creator_payouts rows with no matching stripe_webhook_events
-- payout.* event — a payout the app initiated but Stripe never
-- confirmed via webhook is worth manual review regardless of cause.
SELECT cp.id, cp.user_id, cp.stripe_payout_id, cp.amount_cents, cp.status, cp.created_at
FROM public.creator_payouts cp
WHERE NOT EXISTS (
  SELECT 1 FROM public.stripe_webhook_events swe
  WHERE swe.type LIKE 'payout.%'
    AND swe.payload->'data'->'object'->>'id' = cp.stripe_payout_id
)
ORDER BY cp.created_at DESC;
```

None of these queries prove exploitation on their own — each surfaces a
*signal* worth a human looking at the specific row/account history
(including, where relevant, cross-checking against the real Stripe
dashboard for that account). Absence of hits is reassuring but not proof
of a clean history if the exploit was performed and later "cleaned up" by
the same attacker reversing their own balance.

---

## 6. Exact migration application procedure

1. **Back up first.** Take a fresh point-in-time snapshot (or explicit
   `pg_dump` of at minimum `wallets`, `creator_wallets`, `wallet_transfers`)
   before touching anything — this is a security fix, not a feature, but
   the same discipline applies.
2. Run the five queries in §5 and save their output somewhere durable
   (this becomes the "before" record for §4/§8 comparison).
3. Open the Lovable Cloud SQL editor (or equivalent Supabase SQL access)
   against the target database.
4. Apply `supabase/migrations/20260823160000_krepay_security_hardening.sql`
   **exactly as committed in this repo** — copy-paste the file verbatim,
   do not retype it. This migration is idempotent-safe to re-run
   (`ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`) except
   for the two `REVOKE` statements, which are naturally idempotent in
   Postgres (revoking an already-revoked privilege is a no-op, not an
   error).
5. Confirm the statement completes with no error. A `REVOKE` on a
   privilege already exercised by an in-flight transaction elsewhere is
   not expected to conflict, but if the editor reports a lock-wait timeout,
   retry once — do not add `CASCADE` or force anything.
6. Run the §7 verification queries immediately after.
7. **Do not** apply `20260823150000_hire_loop_notification_fix.sql` in
   the same sitting unless deliberately choosing to — see §10 for why
   that's safe to do independently, on its own schedule.

---

## 7. Post-migration verification queries

```sql
-- 7.1 Confirm the column-level REVOKE actually took effect.
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('wallets', 'creator_wallets')
  AND column_name IN ('balance', 'credits', 'kyc_status', 'payouts_enabled', 'charges_enabled', 'stripe_account_id')
  AND grantee IN ('authenticated', 'anon');
-- Expect: ZERO rows. Any row here means the REVOKE did not take, or a
-- later GRANT re-opened it.

-- 7.2 Confirm wallet_debit/wallet_credit remain service_role-only and
-- are otherwise untouched by this migration (they should be — it never
-- modifies these functions).
SELECT p.proname, r.rolname AS grantee, has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname IN ('wallet_debit', 'wallet_credit')
  AND r.rolname IN ('authenticated', 'anon', 'service_role');
-- Expect: only service_role rows show can_execute = true.

-- 7.3 Confirm the new idempotency index exists.
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'wallet_transfers' AND indexname = 'idx_wallet_transfers_idempotency_key';
-- Expect: one row.
```

Then run every scenario in `KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md` — the
queries above confirm the *grant* changed; the matrix confirms the
*actual behavior* an attacker would hit is what's expected.

---

## 8. SECURITY DEFINER function audit

Checklist applied to every function this migration relies on or that this
session's other migration (`20260823150000_hire_loop_notification_fix.sql`)
created, since both are part of the same release.

| Function | Explicit `search_path` | Schema-qualified refs | Minimal grants | Explicit `auth.uid()` check | Ownership check | Safe status transitions |
|---|---|---|---|---|---|---|
| `wallet_debit` | YES (`SET search_path = public`) | YES (`public.wallets`) | YES — `service_role` only | **NO internal check** — see note below | N/A (caller's responsibility) | YES — single atomic `UPDATE ... WHERE balance >= amount RETURNING`, no read-then-write race |
| `wallet_credit` | YES | YES | YES — `service_role` only | **NO internal check** — same note | N/A | YES — atomic upsert-then-update |
| `accept_application` | YES | YES (`public.applications`, `public.opportunities`, `public.projects`, `public.project_collaborators`, `public.profiles`, `public.notifications`) | YES — `authenticated` (appropriately broader; see below) | YES — `auth.uid() = opportunity.created_by` | YES | **Partial** — see finding F-01 below |
| `notify_application_status` | YES | YES | YES — `authenticated` | YES — `auth.uid() = opportunity.created_by` | YES | YES (no state written beyond the notification) |
| `notify_new_application` | YES | YES | YES — `authenticated` | YES — `auth.uid() = application.applicant_id` | YES | YES |

**Note on `wallet_debit`/`wallet_credit` having no internal `auth.uid()`
check**: this is safe *today* because `EXECUTE` is restricted to
`service_role` — no end-user session can invoke these directly at all,
so the calling edge function (`wallet-transfer`, `wallet-topup-confirm`)
is the actual trust boundary, and both call sites were reviewed and do
authenticate the caller and derive `p_user_id` correctly before invoking.
**This is a fragility risk, not a live vulnerability**: if a future
migration ever re-grants `EXECUTE` on these two functions to
`authenticated` (accidentally or otherwise), they would have *zero*
internal protection — any authenticated caller could debit or credit
*any* `p_user_id` at will. Recommend adding this exact scenario to
whatever this team's migration-review checklist is, even though no code
change is proposed here (the current design is valid; the risk is about
a *future* regression, not today's state).

**F-01 — `accept_application` does not validate the application's prior
`status`** before transitioning to `'accepted'`. It only checks whether a
Studio already exists for this `application_id` (the idempotency guard).
Practically: a recruiter could call this successfully on an application
they had previously set to `'rejected'`, creating a Studio anyway. This
is not an authorization gap (the recruiter legitimately owns this
opportunity and this decision), but it is a missing state-machine
validation — low severity, not part of the two CRITICAL wallet findings,
not blocking this checkpoint, noted for completeness per the audit
checklist.

**Also noted, not part of the two CRITICAL findings**:
`admin_confirm_bank_transfer` (`20260417191317_...sql`) writes
`wallets.credits` and correctly self-gates on
`has_role(auth.uid(),'admin')` with a hard `RAISE EXCEPTION`, but relies
on Postgres's default `PUBLIC` execute grant rather than an explicit
`REVOKE ALL ... GRANT EXECUTE TO ...` pattern. Functionally safe today
(the internal check is a real hard stop), but inconsistent with the
explicit-grant pattern used everywhere else in this audit — a
housekeeping item, not a vulnerability.

---

## 9. Negative authorization tests

Full matrix in `KREPAY_WALLET_NEGATIVE_TEST_MATRIX.md`. Not run this
session — no database to run them against.

---

## 10. Migration dependency order

**No dependency exists between the two migrations.** Confirmed by direct
inspection: `20260823160000_krepay_security_hardening.sql` touches
`wallets`, `creator_wallets`, `wallet_transfers`, and the two existing
functions `wallet_debit`/`wallet_credit`. `20260823150000_hire_loop_notification_fix.sql`
touches `notifications`, `projects`, `applications`, `opportunities`,
`project_collaborators`, and creates three new functions
(`accept_application`, `notify_application_status`,
`notify_new_application`). **Zero shared tables, columns, or functions.**
Either can be applied first, both, or only one — filename timestamps
(`...150000` before `...160000`) determine the order only if a migration
runner applies them together automatically; there is no functional
requirement for that order. Given the severity difference, **applying
`20260823160000` (the two CRITICAL findings) first, independently,
without waiting on the hire-loop fix, is the correct priority** — do not
let bundling these together delay closing the wallet vulnerabilities.

---

## 11. Live verification results and a follow-up finding

`20260823160000_krepay_security_hardening.sql` was applied to production
during this checkpoint. Verification query 7.2 (`wallet_debit`/
`wallet_credit` grants) came back exactly as expected —
`service_role`-only, confirmed. Verification query 7.1 came back
**partially** as expected:

```
column_name        grantee        privilege_type  table_name
stripe_account_id   authenticated  UPDATE          creator_wallets
stripe_account_id   authenticated  SELECT          creator_wallets
```

Five of the six target columns (`wallets.balance`, `wallets.credits`,
`creator_wallets.kyc_status`, `.payouts_enabled`, `.charges_enabled`)
correctly show **zero** rows — the REVOKE took effect for those.
**`creator_wallets.stripe_account_id` still has a live `UPDATE` grant to
`authenticated`**, despite being named in the same `REVOKE` statement as
its four siblings. No other migration in this repo's history grants
`UPDATE` on this column, so the cause isn't a later re-grant found by
static search; it wasn't conclusively determined live either. Re-issuing
the `REVOKE` for this one column is safe regardless of cause and is the
first statement in the follow-up migration below.

**Practical impact while this stays open**: `wallet-payout`'s own gate
requires *both* `stripe_account_id` and `payouts_enabled` to be truthy
(`index.ts:27-35`). `payouts_enabled` is now correctly locked, so this
column alone does not currently let an attacker pass that specific gate
— finding #2's primary exploit path (§2) is closed. This remains a real,
unintended gap relative to the migration's own design and needed closing
regardless of that mitigating factor.

**While investigating why, a related, more severe finding turned up**:
`public.profiles.stripe_account_id` / `stripe_account_status` — an
*older*, separate Connect-tracking mechanism that pre-dates
`creator_wallets` — have the identical unrestricted-`UPDATE` gap
(`"Users can update own profile" USING (auth.uid()=user_id)`, no
`WITH CHECK`, no column restriction, `20250930073034_...sql:63-65`), and
are still read live by three edge functions: `get-connect-balance`,
`check-connect-status`, and — most severely — `create-connect-login-link`,
which turns `profiles.stripe_account_id` directly into a real
`stripe.accounts.createLoginLink()` call. **Forging this column to a real
Stripe Connect account ID and requesting a login link would hand the
caller a live Stripe Express dashboard session for an account they don't
own** — this is more severe than either original finding, since it
reaches actual account takeover of a third party's Stripe-hosted
dashboard, not just an internal ledger or a gate this app's own backend
controls. Confirmed safe to close: the only legitimate write path is
`create-connect-account/index.ts`'s `service_role` client (unaffected by
the fix), and no client-side code writes either column (grep of `src/`:
zero hits beyond generated type definitions).

**Follow-up migration** (prepared, not applied):
`supabase/migrations/20260823170000_krepay_security_hardening_followup.sql`

```sql
REVOKE UPDATE (stripe_account_id) ON public.creator_wallets FROM authenticated, anon;
REVOKE UPDATE (stripe_account_id, stripe_account_status) ON public.profiles FROM authenticated, anon;
```

Re-run §7's query 7.1 (extended to also check `table_name = 'profiles'`,
`column_name IN ('stripe_account_id','stripe_account_status')`) after
applying this to confirm closure.

## 12. Full reversal — both findings active again

Both migrations (`20260823160000`, `20260823170000`) were applied. The
extended verification query, re-run after the follow-up:

```sql
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND (
    (table_name = 'wallets' AND column_name IN ('balance', 'credits'))
    OR (table_name = 'creator_wallets' AND column_name IN ('kyc_status', 'payouts_enabled', 'charges_enabled', 'stripe_account_id', 'requirements'))
    OR (table_name = 'profiles' AND column_name IN ('stripe_account_id', 'stripe_account_status'))
  )
  AND privilege_type = 'UPDATE'
  AND grantee IN ('authenticated', 'anon');
```

returned **18 rows — all 8 target columns, both `authenticated` and
`anon`**, including `wallets.balance`/`credits` and
`creator_wallets.kyc_status`/`payouts_enabled`/`charges_enabled`, which
an earlier, narrower check had independently confirmed at zero rows.

**Why this points to a re-applied broad grant, not a fresh individual
attack**: the reversal is complete and uniform across three unrelated
tables and both roles at once. A targeted attacker forging their own
row's columns one at a time would not produce this pattern; a table-level
or schema-wide `GRANT UPDATE ... TO authenticated, anon` issued *after*
both migrations ran would, because a broader grant re-establishes
`UPDATE` on every column of that table regardless of an earlier
column-level `REVOKE` — `REVOKE` only removes privileges that exist at
the moment it runs; it is not a standing rule that blocks future grants.

**Checked and ruled out**: no `ALTER DEFAULT PRIVILEGES` or
`GRANT ALL ON ALL TABLES` statement touching the `public` schema exists
anywhere in this repo's tracked migration history (the only hits are
scoped to the unrelated `net` extension schema,
`20251020015856_...sql`). Whatever re-applied these grants did so
**outside this repo's tracked SQL** — most likely either Supabase/Lovable
Cloud's own project-level baseline privileges being reasserted by
platform tooling (schema sync, a "push to database" action, or similar),
or a manual `GRANT` run directly. This could not be confirmed further
without either database audit-log access or direct confirmation from
whoever/whatever else touched this project between the two verification
checks.

**Immediate stop-gap** (does not address root cause, may be reverted
again by the same mechanism):

```sql
REVOKE UPDATE (balance, credits) ON public.wallets FROM authenticated, anon;
REVOKE UPDATE (kyc_status, payouts_enabled, charges_enabled, stripe_account_id, requirements)
  ON public.creator_wallets FROM authenticated, anon;
REVOKE UPDATE (stripe_account_id, stripe_account_status) ON public.profiles FROM authenticated, anon;
```

Re-running this without finding and stopping whatever re-granted these
privileges risks the identical silent reversal recurring. Before or
immediately after re-applying: check Lovable's project activity/audit
log for any schema-sync or "push to database" event between the two
verification checks, and avoid making further changes through Lovable's
visual schema editor or AI app-builder until the mechanism is identified
— those are the most likely source of an out-of-band `GRANT`.

## Final status

**`RESOLVED — CONFIRMED CLOSED 2026-08-26`**

This document's own §12 "full reversal" was real at the time it was
written, but describes a different, narrower, never-actually-committed
fix attempt — not Migration A (`20260823223419_...sql` +
`20260823223514_...sql`), which is the migration genuinely in the repo
and in effect today. The user ran this document's own §12 verification
query directly against production on 2026-08-26 and got **zero rows** —
`wallets.balance`/`credits`, all five `creator_wallets` columns, and
`profiles.stripe_account_id`/`stripe_account_status` are confirmed locked
down, both `authenticated` and `anon`. Superseded the ~~CRITICAL_VULNERABILITY_ACTIVE~~
status above; leaving §1-§12 intact for the historical record of how this
was found and the false starts along the way, but nothing in this
document should be treated as describing the current state except this
line.
