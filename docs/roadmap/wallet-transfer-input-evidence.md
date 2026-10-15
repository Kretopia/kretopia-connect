# wallet-transfer: the amount is whole cents, and a currency label cannot open a new limit

Code only: no migration, no policy, no grant, no secret, no data change. The debit, the credit, the limit function, the idempotency reservation and the refund on a failed credit are untouched. Not deployed. This is the "wallet SQL functions and Stripe Connect transfer functions not traced" item of `paid-state-writers-map.md` (#183, section 6), read for the money-moving gate only.

## Findings (repository evidence; not reproduced against a database)
| # | Where | Evidence | Effect |
|---|---|---|---|
| W1 | `wallet-transfer` + `check_transfer_limit` | the function passes the client's `currency` label to the limit check; the check gives every label except `TTD` the **USD limits** but sums the sender's earlier transfers **per label** (`currency = UPPER(p_currency)`). The wallet has one balance and one `wallet_debit`, so a transfer labelled `EUR 100` moves 100 units of the same balance. The dialog offers 13 non-TTD labels; the API accepts any string | the daily and monthly limits (150 / 750 USD by default) can be passed by changing the label: each label starts at a spent total of zero. An account taken over can be drained in per-transaction chunks across labels within a day |
| W2 | `wallet-transfer` + `wallet_debit` / `wallet_credit` | the amount was only checked `!amount \|\| amount <= 0`; `wallets.balance` is `numeric(10,2)` and both functions take an unconstrained `numeric` | an amount with a third decimal rounds differently on the two sides: `10.00 - 0.005 = 9.995` is stored as `10.00` (nothing leaves the sender) while `0 + 0.005` is stored as `0.01` (a cent appears at the recipient). A repeated call creates money, bounded only by the transfer limits that W1 already defeats. `wallet_transfers.amount` is `numeric(12,2)` too, so the recorded row says `0.01` |
| W3 | same | a string, an object or an array passed the truthiness check and reached the RPC | type confusion; a numeric string was moved and then crashed on `amount.toFixed` after the money had moved |
| W4 | same | the note and the idempotency key were stored as sent | unbounded text in two columns |

## What changed
- `_shared/walletTransfer.ts` (pure, no dependency): `cleanTransferAmount` (a number, at least 0.01, at most 1,000,000, at most two decimals; returns the clean value in cents), `limitCurrency` (`TTD` only when asked, otherwise `USD`), `cleanNote` (text only, trimmed, 200 characters), constants.
- `wallet-transfer`: a missing Authorization header answers "User not authenticated"; the amount and the currency bucket are checked **before** the reservation row, the limit check and any debit; the stored label and the limit bucket are `USD` or `TTD`; an over-long or non-text idempotency key is refused; a refund that fails after a failed credit is **logged loudly** ("ROLLBACK FAILED") instead of swallowed.

## Tests
`src/lib/__tests__/walletTransfer.test.ts` (16). Denied first: 0.005, 0.015, 0.001, 0.004, 1.005, 10.999; zero, negatives, NaN, infinities, above the ceiling, 1e21, 2^53; numeric strings, null, objects, arrays, booleans; the 13 labels of the dialog and 200 invented ones all land in one bucket; TTD is kept in any case. Wiring: checks come before the reservation, the limit check and the debit; amount and currency are read from the body once; the debit, credit, limit and 23505 lines are untouched. Not run: against Postgres (W2 is derived from the column types and PostgreSQL's numeric rounding, not reproduced).

## Please check (decisions that are yours)
- **Currency semantics.** The wallet is one balance shown as USD, but the dialog offers 15 labels and the notification says "$5.00 EUR". Today a "JPY 100" transfer moves 100 USD units. I normalised every label except TTD to `USD` (so the limits cannot be passed and the stored label is the unit that really moved) rather than refuse them, so no screen breaks. Whether to reject non-USD labels in the dialog, or build real multi-currency, is a product decision.
- **TTD.** A transfer labelled `TTD` is limited by the TTD thresholds (1,000 / 5,000 / 5,000 by default) but still debits the same balance one-for-one, so it is allowed several times the USD amount. I left it as is because it may be intended for a TTD wallet; if the balance is USD, it is W1 again with one label.
- **Ceiling.** 1,000,000 per transfer is my choice (the balance column cannot hold more than 99,999,999.99); the per-transaction limits are lower for every tier.

## Found, not changed (needs SQL, so a proposal and your approval)
- **The limit check is not atomic with the debit.** Concurrent requests all read the same spent total and all pass; bounded by the balance. A fix needs a lock or a reserve-then-check inside one function (a migration).
- **Its arithmetic also over-refuses.** It sums every row of the sender, including `failed` ones and, for a keyed request, the request's own `pending` reservation, and then adds the amount again, so a keyed transfer is counted twice and a failed one counts against the limit. Fails closed, but a status filter and excluding the own row belong in SQL.
- **`wallet_transfers.idempotency_key`.** The function and the dialog insert and match on this column, and **no migration in the repository adds it** (the only `idempotency_key` migration is for milestone commission transfers). Either production has it (added outside the repository), or every dialog transfer fails at the reservation. A read-only production question: does the column exist, and is there a unique index on it?
- **Debit and credit are two calls.** A crash between them, or a refund that fails (now logged), loses or strands funds. A single SQL function doing both in one transaction would close it (a migration).

## Release and rollback
Paste `_shared/walletTransfer.ts`, then `wallet-transfer`. Rollback: re-paste the previous function; the helper can stay. No frontend change: a refused amount comes back as `{ error }` with status 500, as every refusal of this function already did.
