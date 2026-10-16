# guest wallet: a paid top-up is credited once or retried, and a code cannot be guessed in parallel

Code only: no migration, no policy, no grant, no secret, no data change. The Stripe signature, mode and paid checks, the event ledger, the per-email code limit, the code expiry and the fail-closed email behaviour are untouched. Not deployed. This is the guest wallet named as unread in #199 (`guest-wallet-topup`, `guest-wallet-webhook`, `guest-wallet-me`, `guest-wallet-session`).

## What was reviewed and is fine
- **Currency.** `guest-wallet-topup` accepts USD only (`z.enum(["USD"])`), and its row stores `amount_cents` that is also the amount charged: no exchange-rate gap like the main wallet's (#199). The amount is 1 to 1,000 dollars.
- `guest-wallet-me` and the top-up creation resolve the wallet from the session token; a token only opens its own wallet.
- A verification code is required before a wallet is created or a session minted, and the function fails closed when the email provider is not configured.
- **There is no debit path in any function today**: the guest balance is credited by the webhook and read by `guest-wallet-me`. So the findings below are about credits and about access, not spending.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| G1 | `guest-wallet-webhook` | the event is written to `stripe_webhook_events` **before** processing; a failure answers 500, but Stripe's retry then hits the ledger row ("already seen") and gets 200 | a failure between the claim and the credit means the guest paid and **is never credited**, silently |
| G2 | same | the top-up is claimed `succeeded` before the credit and the claim is never given back; the claim's own result (`.eq("status", "pending")`) was not read | a failed credit leaves a `succeeded` top-up with no money; a second delivery for the same top-up that matched no row still went on to credit (a double credit) |
| G3 | same | the balance is read, then written back as `balance + amount` | two credits landing together lose one: a guest who paid twice is credited once |
| G4 | same | the session was not compared with the row it credits | any paid session of our Stripe account carrying this metadata would credit the row's amount; only our own code creates them, so this is the second lock, not an exploit today |
| G5 | `guest-wallet-session` | the code came from `Math.random` | a general-purpose generator is predictable; a verification code should not be |
| G6 | `guest-wallet-session` | attempts are read, compared, then incremented after a mismatch (`attempts + 1` from the value read) | parallel guesses all read the same count and are all compared: the limit of five attempts per code does not hold under concurrency (five codes an hour per email still bounds the rate) |
| G7 | `guest-wallet-session` | a code is marked consumed with no condition | two correct submissions at once open two sessions |

## What changed
- `_shared/guestWalletCredit.ts` (pure): `creditGuestWallet` (a compare-and-set on `balance_cents`, retried when it loses a race; refuses a non-positive or non-integer amount and an overflow of the integer column) and `guestTopupMismatch` (the paid session must be a one-time payment for the row's cents, in USD, with the row's top-up and wallet ids).
- `guest-wallet-webhook`: the session is matched to its row first (a mismatch is logged and ignored with a 200); the claim reads its result (no row means another delivery took it); the credit is the compare-and-set; **if the credit fails the claim goes back to `pending` and the event's ledger row is deleted**, so Stripe's retry is processed instead of being answered "already seen"; the audit line can no longer throw after the credit.
- `guest-wallet-session`: the code is drawn from `crypto.getRandomValues`; an attempt is taken **before** the comparison, conditional on the count that was read (parallel guesses are refused unevaluated); a code is consumed conditionally and the result read.

## Tests
`src/lib/__tests__/guestWallet.test.ts` (17). Denied first: non-positive, fractional, non-finite, string and huge credits write nothing; an overflowing credit; a wallet that is gone, unreadable or whose write fails; **ten simultaneous credits: the balance is exactly the sum of the credits that succeeded, and none is lost**; a session in another amount, currency, wallet, top-up or mode, or with no metadata. Wiring: the session is matched before the claim and the credit; the claim's result is read; no read-then-write remains; a failed credit gives back the claim and the ledger row; the code comes from the CSPRNG; the attempt precedes the comparison; the consume is conditional; the existing limits stay. Mutation check: removing the balance guard fails both concurrency tests. Not run: against Stripe or a database.

## Please check
- A session that does not match its row is **ignored with a 200** (logged "REFUSED"), not retried: it cannot be fixed by retrying. If you ever change the top-up session's metadata or mode, the check must change with it.
- Giving back the ledger row on a failure means a Stripe retry (within its retry window) credits the guest; if a failure repeats, the event stays unprocessed in Stripe's dashboard.
- A guest balance that was already lost to G1 or G3 is not repaired by this change. Finding it needs the Stripe side: top-ups `succeeded` whose wallet has no matching `guest_wallet_transactions` row. A read-only question for whoever has production access; a repair is a data change for you to approve.

## Found, not changed
- **The sender.** `guest-wallet-session` sends the code from `noreply@kretopia.com` through Resend. The email pipeline notes say the mail domain that worked in production is `thrivein.io` (the Kretopia domain failed with a sender-domain mismatch). If that domain is not verified at Resend, **no guest can receive a code**. I did not change a sender identity: whoever owns the email setup should confirm the domain.
- No per-IP limit on code requests (the per-email limit of five an hour applies).
- A guest session token is a bearer UUID with an expiry; it is not bound to a device. Its reach is the guest's own wallet.

## Release and rollback
Paste `_shared/guestWalletCredit.ts`, then `guest-wallet-webhook`; `guest-wallet-session` has no new import. No frontend change. Rollback: re-paste the previous functions; the helper can stay.
