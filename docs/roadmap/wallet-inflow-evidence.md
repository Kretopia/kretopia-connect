# wallet top-up and payout destination: the wallet is credited in its own currency, and a new bank is announced

Code and one dialog option: no migration, no policy, no grant, no secret, no data change. The Stripe Checkout mechanics, the session/metadata/amount verification, the claim that lets only one confirmation win, the Connect account creation and the external-account attach are untouched. Not deployed. This reads the entry side of the wallet (`wallet-topup`, `wallet-topup-confirm`) and the payout destination (`wallet-add-bank`) that the previous slice (#198) named as unread.

## Findings (repository evidence; not reproduced against Stripe)
| # | Where | Evidence | Effect |
|---|---|---|---|
| T1 | `wallet-topup` + `wallet-topup-confirm` | the wallet has one `balance`, shown as USD everywhere; `wallet-topup` let the caller choose `currency`, charged that currency at Stripe, and `wallet-topup-confirm` credited **the same number** with `wallet_credit(topup.amount)`. The confirmation checked the session's metadata and `amount_total`, not its currency. The dialog itself offered TTD | **the wallet could be minted at any exchange rate.** A top-up of 10,000 in a cheap currency (a few dollars at Stripe) credits 10,000 of balance; TTD at about 6.8 per USD is credited at face value through the product's own option. The balance is then transferable (`wallet-transfer`) |
| T2 | `wallet-topup-confirm` | the top-up is claimed `completed` **before** `wallet_credit`; if the credit fails the error is thrown and the row stays `completed` | a paid top-up that is never credited and answers "Already confirmed" on every retry |
| T3 | `wallet-topup` | `amount` only checked truthy and `<= 10000`; `wallet_topups.amount` is `numeric(12,2)` | a third decimal rounds differently in the row (half away from zero) and in `Math.round(amount * 100)`: `10.005` is stored as 10.01 but charged 1,000 cents, so the confirmation's amount check fails and a paid top-up cannot be credited |
| T4 | `wallet-topup` | the WiPay placeholder inserted a `pending` row before answering "coming soon" | junk pending rows |
| B1 | `wallet-add-bank` | fields used as sent; `currency.toUpperCase()` ran after `stripe.accounts.create`; `make_default` went to Stripe as any truthy value; an idempotency key that was not text was replaced by a random one | a crafted request leaves an orphan Connect account behind and answers 500; unbounded text |
| B2 | `wallet-add-bank` + `wallet-payout` | a session can add a bank account, make it the default (the default is `make_default = true`) and cash out the connected balance to it; nothing tells the owner | the account-takeover path: the only control is whoever reads the account's notifications |

## What changed
- `_shared/walletTopup.ts` (pure): `cleanTopupRequest` (a number of whole cents from 0.01 to 10,000, **currency USD only**, gateway `stripe` or `wipay`) and `topupCurrencyMatches`.
- `wallet-topup`: the request is checked before any row or Stripe call; the currency is the wallet's own; WiPay answers before a row is created; a missing Authorization header answers cleanly.
- `wallet-topup-confirm`: **a top-up row or a Stripe session in another currency is refused** (logged "REFUSED non-USD top-up") before the claim and the credit; a claim whose credit fails is **given back** (status, `completed_at`, payment id restored) so a retry can credit it, and logged if even that fails ("TOP-UP CLAIMED BUT NOT CREDITED").
- `WalletTopUpDialog.tsx`: TTD is no longer offered.
- `_shared/bankRequest.ts` (pure): `cleanBankRequest` (2-letter country, 3-letter currency, holder name up to 140, account and routing numbers of plausible shape, boolean `make_default`, text key up to 100), run before the first Stripe call.
- `wallet-add-bank`: after the bank is saved, an **in-app notification** tells the owner "A bank account ending in ... was added for payouts" (and whether it became the default). It never blocks the request.

## Tests
`src/lib/__tests__/walletInflow.test.ts` (27). Denied first: every currency but USD (TTD, EUR, JPY, IDR, VND, COP, NGN, KES, non-text), non-numeric, zero, negative, infinite and fractional-cent amounts, amounts above the ceiling, unknown gateways; a row or session in another currency; missing, non-text, malformed and over-long bank fields, a non-boolean `make_default`, a bad key. Wiring: the request is checked before any row, Stripe call or Connect account; WiPay answers before the row; the currency check precedes the claim and the credit; the session, metadata, amount and claim checks stay; a failed credit gives the claim back; the notification follows the saved method; the dialog has no TTD. Not run: against Stripe or a database.

## Please check (decisions that are yours)
- **TTD top-ups are switched off.** Until there is a conversion policy, a top-up is in USD. If Trinidad users are meant to hold TTD, the wallet needs a currency column (or a rate table), not a second currency label on one number.
- **Existing exposure.** Past top-ups in other currencies were credited at face value. Read-only question: `SELECT currency, status, count(*), sum(amount) FROM wallet_topups GROUP BY currency, status` (and `payment_gateway`). Repairing balances is a data change for you to approve, and a balance may already have been transferred.
- **Pending non-USD top-ups** that were paid before this change can no longer be confirmed (the function says to contact support). They need a person to settle them.
- **The payout takeover path is only half closed.** The notification is in-app: an attacker holding the session can read and clear it. The controls that actually stop it are an email to the address on file (needs a template and a sender), a cooldown between adding a bank and cashing out to it, and a fresh sign-in to change a destination: product decisions I did not make.

## Found, not changed
- `guest-wallet-topup` and `guest-wallet-webhook` (the guest wallet) were not read here; they credit a separate guest balance and should be read for the same currency question.
- `wallet-add-bank` does not compare the bank account holder's name with the verified identity of the Connect account (Stripe's own checks apply).
- A user can attach any number of bank accounts to their connected account; Stripe is the only bound.

## Release and rollback
Paste `_shared/walletTopup.ts`, then `wallet-topup` and `wallet-topup-confirm`; paste `_shared/bankRequest.ts`, then `wallet-add-bank`; publish the frontend (the dialog) with the next publish. Order does not matter for safety: an old dialog offering TTD simply gets "Wallet top-ups are in USD only for now". Rollback: re-paste the previous functions and revert the dialog; the helpers can stay.
