# Lot D -- concurrency test (run by you, on an ISOLATED database, never on production)

Status until this test has been run and matches: **WAITING_FOR_VALIDATION**. Not run by the author (no database, and by rule no `psql`).

What it must show: with many simultaneous confirmations of the same top-up, the wallet is credited **exactly once**, and a failed credit
leaves the top-up pending.

## 1. An isolated database and the minimum schema

Use the same throwaway database and `stubs.sql` as lot A's test, then create the tables the function touches (copied from the repository's
migrations, only the columns involved) and `wallet_credit` exactly as the migration `20260804103153` defines it:

```sql
CREATE TABLE public.profiles (user_id uuid PRIMARY KEY);
CREATE TABLE public.wallets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE,
  credits integer DEFAULT 0 CHECK (credits >= 0), balance numeric(10,2) DEFAULT 0.00 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'USD', updated_at timestamptz DEFAULT now());
CREATE TABLE public.wallet_topups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  amount numeric(12,2) NOT NULL, currency text NOT NULL DEFAULT 'USD', payment_gateway text NOT NULL DEFAULT 'stripe',
  gateway_session_id text, gateway_payment_id text, status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, CONSTRAINT wallet_topups_positive_amount CHECK (amount > 0));
-- paste public.wallet_credit(uuid, numeric) from supabase/migrations/20260804103153_*.sql here
```

Then `01_preflight.sql`, `02_apply.sql`, `03_verify.sql` of this folder.

## 2. Thirty simultaneous confirmations of one top-up

```sql
INSERT INTO public.profiles VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.wallet_topups (id, user_id, amount) VALUES ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 25.00);
```

`confirm.sql`:

```sql
SELECT applied FROM public.complete_wallet_topup('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'cs_test_one');
```

```bash
pgbench -n -f confirm.sql -c 30 -j 8 -t 1 topup_test
```

Expected, exactly:

```sql
SELECT balance FROM public.wallets WHERE user_id = '11111111-1111-4111-8111-111111111111';   -- 25.00  (not 50.00, not 750.00)
SELECT status, gateway_payment_id FROM public.wallet_topups WHERE id = '22222222-2222-4222-8222-222222222222';  -- completed, cs_test_one
```

Across the 30 sessions exactly one returned `applied = true`. (Run `pgbench ... -r` or log the results to count; or run 30 calls from `psql` windows.)

## 3. A failed credit leaves the top-up pending

```sql
CREATE OR REPLACE FUNCTION public.wallet_credit(p_user_id uuid, p_amount numeric) RETURNS numeric LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END $$;
INSERT INTO public.wallet_topups (id, user_id, amount) VALUES ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 5.00);
SELECT * FROM public.complete_wallet_topup('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'cs_test_two');  -- ERROR: forced failure
SELECT status FROM public.wallet_topups WHERE id = '33333333-3333-4333-8333-333333333333';   -- pending (the claim was rolled back)
```

Put the real `wallet_credit` back afterwards.

## 4. One payment, one top-up

```sql
INSERT INTO public.wallet_topups (user_id, amount, status, gateway_payment_id) VALUES ('11111111-1111-4111-8111-111111111111', 1.00, 'completed', 'cs_dup');
INSERT INTO public.wallet_topups (user_id, amount, status, gateway_payment_id) VALUES ('11111111-1111-4111-8111-111111111111', 1.00, 'completed', 'cs_dup');   -- must fail: unique index
```

## What to report back

The balance, the status row, the count of `applied = true`, and the two errors. If the balance is not 25.00, do not change the code.

## After it passes: the code part (not done in this session)

`wallet-topup-confirm` replaces its claim, its `wallet_credit` call and its revert by one call to `complete_wallet_topup(topup.id, user.id, topup.gateway_session_id)`; `applied = false` answers "Already confirmed"; an error leaves the top-up pending so a retry can credit it. The currency and amount checks of `walletTopup.ts` stay in the function (the SQL repeats only the USD check). The `transactions` insert stays best-effort after the call. The guest wallet (`guest-wallet-webhook`) has the same shape on `guest_wallet_topups` and is a separate lot once its table definition is confirmed.
