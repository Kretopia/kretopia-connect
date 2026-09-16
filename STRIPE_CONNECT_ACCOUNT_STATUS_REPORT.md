# Stripe Connect Account Status Report

Project: Kretopia · ref `kwmcocsitwssrtzkdojh` · 2026-08-24
Read-only audit. Nothing was altered: no capability, requirement, payout
setting, `payouts_enabled` or `kyc_status` was written.

## Platform account
| Field | Value |
|---|---|
| Account ID | `acct_1GweNPJvOS7zG18h` |
| Display name | ThriveIN (pre-rebrand; Kretopia branding not yet applied in Stripe) |
| Mode of the credential in use | live |

## Connected accounts (sample of live Connect accounts)

| Field | `acct_1U4f5v2UG54RERl2` | `acct_1SytKNFIOxgUn4hn` |
|---|---|---|
| Type | Express (controller: application, `requirement_collection=stripe`, `losses.payments=application`) | Express, same controller shape |
| Country / currency | GB / gbp | GB / gbp |
| `details_submitted` | true | true |
| `charges_enabled` | **false** | **false** |
| `payouts_enabled` | **false** | **false** |
| `capabilities.card_payments` | inactive | inactive |
| `capabilities.transfers` | **inactive** | **inactive** |
| `requirements.disabled_reason` | **`rejected.fraud`** | see account (charges disabled) |
| `requirements.currently_due` | `business_profile.mcc`, `business_profile.url`, `external_account`, `individual.address.*`, `individual.dob.*`, `individual.email`, `individual.first_name`, `individual.last_name`, `individual.phone`, `tos_acceptance.date`, `tos_acceptance.ip`, plus a supportability rejection-appeal form | outstanding requirements present |
| `requirements.past_due` | same list as currently_due | present |
| External accounts (bank) | **none** (`total_count: 0`) | — |
| Payout schedule | daily, `delay_days: 7` | — |

## Findings
1. **No connected account can currently receive money.** `transfers` is
   inactive and `payouts_enabled` is false everywhere sampled.
2. One account carries `disabled_reason: rejected.fraud`, which requires a
   Stripe supportability appeal — it cannot be resolved from code.
3. No external bank account is attached, so even an enabled account has no
   payout destination.

## Verdict
**BLOCKED_CONNECT_PAYOUTS.** Creator payouts and transfers are blocked. No
transfer, payout or refund was created. The wallet code path already fails
closed: `wallet-payout` refuses to call Stripe unless
`creator_wallets.payouts_enabled` is true, and that column is written only by
the verified `account.updated` webhook — never by the client.
