# Invoices: a provider reference, an honest label and a closed INSERT path

Answers the owner's choice of 2026-10-15 for PM-2 of `paid-state-writers-map.md`: *"(a) once the column is confirmed, then (c) the label « auto-déclaré » for manual invoices"*. The owner ran the read-only checks: **`invoices.stripe_payment_intent_id` does not exist in production** (no row from the column query; `42703` from the count query). This slice therefore starts by making the schema match the code, then does (a) and (c).

Code and one reviewed migration file. **The migration is not applied by anyone**: it is a file in this PR for the owner to apply deliberately. Nothing is deployed.

## What the check established (production, 2026-10-15, read-only, run by the owner)
| Fact | Consequence |
|---|---|
| `invoices` has no `stripe_payment_intent_id` (and no `creator_id`) | `stripe-marketplace-webhook` writes `status`, `paid_at` and `stripe_payment_intent_id` in one UPDATE: that UPDATE fails and the error was not read. **An invoice paid through Stripe stayed unpaid** while the log said "Invoice marked paid" and the function answered 200. |
| the same | a chased client who had already paid could still be sent a reminder (the reminder rule of #179 refuses only invoices marked paid). |
| no `creator_id` | `HireMeTrustBar` queried a column that is not there: its confidence label never showed (PM-4). |

## Findings
| # | Finding | Evidence |
|---|---|---|
| **PM-6 (confirmed)** | Provider-paid invoices were never recorded as paid | production check above; webhook lines writing the column |
| **PM-7 (new)** | A project member can **INSERT** an invoice with `status = 'paid'` and a `paid_at`, bypassing both the UPDATE column grants (`20260904180000`) and the `confirm_invoice_paid_manually` note | the INSERT policy `Users can create invoices for their projects` checks only `issued_by = auth.uid()` and project access; the `status` CHECK allows `paid`. Once a provider column exists, the same INSERT could carry a made-up reference |

## What changed
1. **Migration (file, not applied)** `supabase/migrations/20261015100000_invoices_provider_reference.sql`: adds the nullable column; revokes client UPDATE on it (belt and braces: the table-level UPDATE was already revoked and re-granted per column); a `BEFORE INSERT` trigger refuses, for `authenticated` and `anon` only, an invoice inserted as `paid`, with a `paid_at`, or with a provider reference. The service role, SECURITY DEFINER functions and the SQL editor are unaffected, so the webhook and `batch-milestone-payout` (service role, inserts a paid payout invoice) keep working. The client's own inserts send only `status: "draft"`. No policy, grant to clients, data or other table is touched.
2. **`stripe-marketplace-webhook`**: the invoice UPDATE's error is read; if the payment cannot be recorded the function answers 500 so Stripe retries (before: 200). Nothing else in the webhook changes.
3. **Public trust signals count only provider-confirmed invoices**: `BookedThisMonthChip` (public profile, swipe card) and `HireMeTrustBar` (public profile, EPK) filter on the reference. `HireMeTrustBar` also now queries `issued_by`. Before the migration the filter errors and the chips show nothing: that is the honest state, since no invoice has a reference.
4. **(c) the label**: the issuer's own invoice list shows "paid · self-reported" on a paid invoice with no provider reference (`src/lib/invoiceProvenance.ts`). The issuer's money dashboards keep counting paid invoices as collected: they are the issuer's books.

## Order (safe at every step)
1. Apply the migration (the owner). Applying it alone changes nothing a user can see.
2. Paste `stripe-marketplace-webhook`. From then on a Stripe-paid invoice is marked paid and carries its reference.
3. Publish the frontend.
Pasting the webhook **before** the migration makes every invoice payment answer 500 (Stripe retries for days, then the invoice is still unpaid): no worse than today, but noisy. Publishing the frontend before the migration only blanks the two chips.

## Historical invoices
Every invoice marked paid so far was marked by its issuer (the Stripe path never worked), so none has a reference and all read "self-reported". Invoices Stripe was paid for in the past and never recorded are **not** repaired by this change; finding them needs the Stripe side (the paid checkout sessions of kind `invoice`) and is a data repair the owner must approve separately.

## Tests
`src/lib/__tests__/invoiceProvenance.test.ts` (13): provider-confirmed, self-reported (null, empty, blank), not paid, non-string reference; the webhook reads the error and answers 500 before logging success, and still writes the reference on a paid session only; the two chips filter on the reference and `issued_by`; the list labels; the migration adds one nullable column, revokes the client UPDATE, blocks API inserts as paid, dated paid or referenced, and contains no policy, grant, data change or other table; the client inserts only drafts. Not run: the migration against a database, a real Stripe event.

## Not addressed
`HireMeTrustBar` and the chip count invoices only: the Passport "credits" and other public signals were not re-read. Manual confirmation by the issuer remains possible (it is the issuer's books). The marketplace order status (PM-3) is still writable by buyer and seller (#160).

## Rollback
Re-paste the previous webhook and the previous chips; drop the trigger and its function; the column may stay.
