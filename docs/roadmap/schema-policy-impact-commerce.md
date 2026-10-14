# Schema / policy impact proposal: marketplace commerce

Proposal only. **Nothing here was applied, and nothing here is runnable.** Per the program rules (and a past incident where a draft SQL block in a proposal was pasted and run), the statement sketches below use `<PLACEHOLDER>` tokens and will fail if pasted. The real migration is written only after approval, in its own PR, against the live definitions captured in step 0.

Covers the SQL half of the findings that PR #157 (entitlement) and PR #159 (path ownership) could only guard in code: **matrix rows 6, 7 and 14** (GA SEC-09, SEC-15, PROD-05; CE p.18, p.33). Written against `supabase/migrations/20251109022231_*`, `20260211151221_*`, `20260211153602_*` and `20260217071053_*`, which are the only migrations that define these objects in this repository.

The functions already refuse to trust these records (after the manual paste of #157 and #159). This proposal removes the ability to write them, so that the functions are no longer the only boundary.

## 0. Prerequisite: capture the live state (read-only, by someone with production access)

A migration's presence is not proof it was applied. Before any change, capture:

- the effective policies on `digital_product_purchases`, `marketplace_orders`, `digital_products`, and on `storage.objects` for the buckets `product-files` and `portfolio` (`pg_policies`);
- column privileges and triggers on `marketplace_orders` and `digital_product_purchases` (the repository defines only an `updated_at` trigger);
- counts, as numbers only: purchase rows by `payment_status`; orders by `status` and by `delivery_status`; products whose `file_urls` hold an absolute URL, and how many of those point at the public `portfolio` bucket; products whose `file_urls` contain a path outside the seller's own folder;
- whether any order row has a `status` that Stripe does not support (a reconciliation report, read-only, never a bulk write).

The read-only statements will be provided in a separate preflight file, as was done for the meeting proposal, once this document is approved in principle.

## 1. Objects affected and current unsafe behaviour

| # | Object | Unsafe behaviour today | Consumers that must keep working |
|---|---|---|---|
| C-A | `digital_product_purchases` INSERT policy "Users can create purchases" (`auth.uid() = buyer_id`) | The buyer writes their own purchase row with any `payment_status`, `amount` and `product_id`. Only `complete-product-purchase` (service role) is a legitimate writer. #157 stops `get-download-urls` trusting it, but the row still exists, shows in the buyer's and seller's UI, and any future reader inherits the same trap | `complete-product-purchase` (service role). No `src/` code reads or writes this table |
| C-B | `marketplace_orders` UPDATE policies "Buyers can confirm delivery" and "Sellers can update shipping" (both `USING` and `WITH CHECK` on the party id only, **no column restriction**) | The buyer can write `status`, `escrow_released_at`, `buyer_confirmed_at`, `amount`, `download_urls`; the seller can write `status`, `amount`, `platform_fee`, `escrow_released_at`, `payment_intent_id`. A refunded buyer can set `status` back to `completed`; a seller can mark their own order released. `AccountingDashboard.tsx` sums the orders whose `status = completed`, so a client-written value also changes the revenue and spend a user is shown. Payment state truth (matrix row 14) is client-writable | `release-escrow` (service role: confirm, dispute, auto-release); `SellerOrderCard.tsx` writes only `delivery_status`, `shipped_at`, `tracking_number`, `delivered_at` as the seller; `MyPurchases.tsx` and `AccountingDashboard.tsx` only read |
| C-C | `digital_products` SELECT "Anyone can view active products" (all columns, anonymous included) and UPDATE "Users can update their own products" (`user_id` only) | `file_urls` (the paid files' storage paths) is public; the seller writes it with no validation (the chain closed in code by #159). `price`, `is_active` and `file_urls` can change after a sale | `Marketplace` listing and detail pages (read); `CreateListingDialog`, `DigitalProductsSection` (seller writes); the three delivery functions (service role) |
| C-D | Legacy `file_urls` entries | The unmounted `AddDigitalProductDialog` uploaded paid files to the **public** `portfolio` bucket and stored absolute URLs in `file_urls`. Any such row is downloadable by anyone | Delivery functions pass absolute URLs through unsigned |
| C-E | `marketplace_orders.download_urls` | The webhook persists 7-day signed URLs in a row the buyer (and seller) can read | `complete-product-purchase` returns the stored value on a repeat call |

## 2. Target policy (what must be true afterwards)

1. **C-A.** A client can read its own purchase rows and cannot create, change or delete any. Only the service role writes the table.
2. **C-B.** Payment-state columns (`status`, `amount`, `platform_fee`, `currency`, `payment_intent_id`, `checkout_session_id`, `escrow_released_at`, `buyer_confirmed_at`, `auto_release_at`, `dispute_reason`, `download_urls`, `listing_id`, `buyer_id`, `seller_id`, `listing_type`) change only through a service-role function. The seller may change the delivery fields (`delivery_status`, `shipped_at`, `delivered_at`, `tracking_number`, `delivery_notes`) of their own order, and only forward along the delivery states. The buyer has no direct UPDATE: confirmation and dispute already go through `release-escrow`.
3. **C-C.** Anonymous and ordinary readers see the listing without the paid-file locations. `file_urls` is readable by the seller (own rows) and the service role only. A write to `file_urls` is accepted only when each entry is in the seller's own folder (or is legacy and unchanged).
4. **C-D.** No new paid file lives in a public bucket. Existing legacy rows are reported per seller, never rewritten in bulk.
5. **C-E.** Signed URLs are never stored. The order keeps paths; URLs are signed on demand (one hour) for the entitled buyer.

## 3. Migration sketches (NOT RUNNABLE, for review of intent only)

```
-- C-A  purchases are system-written                            [fixes F1, SQL half]
-- NOT RUNNABLE
DROP POLICY <"Users can create purchases"> ON public.digital_product_purchases
-- SELECT policy (buyer or seller) stays; no INSERT/UPDATE/DELETE policy remains for authenticated
-- service role bypasses RLS: complete-product-purchase is unaffected
```

```
-- C-B  order state is system-written; delivery fields are the seller's   [matrix row 14]
-- NOT RUNNABLE
DROP POLICY <"Buyers can confirm delivery"> ON public.marketplace_orders
--   release-escrow (service role) is the only confirm/dispute path in the code
-- Seller UPDATE: keep one policy (seller_id = auth.uid()), and add the column guard:
CREATE FUNCTION <guard_order_update>() RETURNS trigger
  -- when auth.uid() IS NOT NULL (a client write):
  --   require NEW.<every payment-state column> IS NOT DISTINCT FROM OLD.<same>
  --   require NEW.delivery_status in the forward transition table of section 2.2
  -- service role (auth.uid() IS NULL): unchanged
CREATE TRIGGER <name> BEFORE UPDATE ON public.marketplace_orders FOR EACH ROW ...
-- Option 2 (alternative): column-level GRANT UPDATE (<delivery columns>) to authenticated and
--   REVOKE the table-level UPDATE. Simpler to read, but any future column is then silently
--   unwritable; the trigger fails closed with an explicit message instead.
```

```
-- C-C  paid-file locations are not part of the public listing  [matrix row 6]
-- NOT RUNNABLE
-- Option 1 (recommended): a view for browsing
CREATE VIEW <public_listing> AS SELECT <every column except file_urls> FROM public.digital_products
  WHERE is_active  -- with the owner's identity semantics decided in section 7
-- the Marketplace pages read the view; the base table policy "Anyone can view active products"
-- is replaced by owner-only SELECT; delivery functions use the service role.
-- Option 2 (rejected): column-level REVOKE on file_urls. Any `select *` by a non-owner then
--   fails with a permission error, and the listing pages use `select *`.
CREATE FUNCTION <guard_product_file_urls>() RETURNS trigger
  -- on INSERT/UPDATE by a client: every entry of NEW.file_urls is either unchanged from OLD,
  --   or an absolute URL (legacy), or starts with auth.uid() || '/'  (same rule as #159)
```

```
-- C-D  legacy public-bucket products                           [data, no DDL]
-- Report only: per seller, the products whose file_urls point at the public portfolio bucket.
-- Remediation is per seller and optional: re-upload to product-files through the existing
-- listing dialog; no bulk rewrite of production records.
```

```
-- C-E  stop persisting signed URLs                              [code + data]
-- Code (separate PR): stripe-marketplace-webhook stores paths like complete-product-purchase;
--   complete-product-purchase signs fresh one-hour URLs from the stored paths on a repeat call.
-- Data: existing 7-day URLs in download_urls are already dead after 7 days; no rewrite proposed.
```

### 2.2 Delivery transition table (for C-B)

`pending -> shipped -> delivered`, and `pending -> completed` for services. A seller may not move a state backwards or skip to `delivered` without `shipped` for a physical listing. Any other value is refused by the guard.

## 4. Storage policy impact

- `product-files` (private; own-folder read and write): **unchanged**. The delivery functions remain the only path for buyers.
- `portfolio` (public): no policy change. The rule is organisational: no paid file there (C-D).
- No new bucket is created, no bucket is made public, no signed-URL expiry is lengthened.

## 5. Data migration, backfill and compatibility

| Change | Existing data | Backfill |
|---|---|---|
| C-A | all rows stay; the buyer and seller still read them | none |
| C-B | no row changes. Rows whose `status` was written by a client stay as they are | a **read-only reconciliation report** of orders against Stripe (status, amount, refund), reviewed by a person; no bulk write |
| C-C | the view exposes the same rows minus one column | none; the frontend listing pages switch to the view in the same release |
| C-D | untouched | report only |
| C-E | untouched | none |

Compatibility: SellerOrderCard's two writes keep working (delivery columns, forward transitions). Anything that wrote `status` from the client breaks by design; the code search found none.

## 6. RLS impact by role

| Role | C-A purchases | C-B orders | C-C products |
|---|---|---|---|
| Anonymous | no access | no access | listing without `file_urls` |
| Authenticated, unrelated | no access | no access | listing without `file_urls` |
| Buyer | read own; **no insert** (was: any) | read own; **no update** (was: any column); confirm and dispute through `release-escrow` | listing without `file_urls` |
| Seller | read own sales | read own; update delivery fields only (was: any column) | read and write own, including `file_urls` under the folder rule |
| Refunded buyer | read own | cannot restore `status` (was: could) | unchanged |
| Service role | unchanged | unchanged | unchanged |

## 7. Decisions needed from the approver

1. **Order state authority.** Confirm that no client other than the seller's two delivery writes needs to update `marketplace_orders` (the repository search found none).
2. **Listing visibility.** The view in C-C must carry the same "who is the seller" fields the listing pages show today; confirm whether the seller's profile fields stay in the view or are joined separately.
3. **Legacy absolute URLs.** Keep passing them through unsigned (today), or refuse them in the delivery functions once the report shows how many exist.
4. **Self-purchase.** The code of `purchase-digital-product` shows no refusal of a seller buying their own product; decide whether it should (it affects revenue reporting, not security).
5. **Notification.** Whether sellers with legacy public-bucket products are told, and how.

## 8. Rollout sequence

1. Paste the code of #157 and #159 into `kretopia-app` (manual). Without this, C-A and C-B change nothing the functions rely on.
2. Capture section 0 (read-only) and review the counts.
3. **C-A** (smallest blast radius: no client reads or writes this table).
4. Code PR for C-E, then the **C-B** guard once the reconciliation report is reviewed.
5. Frontend PR switching the listing pages to the view, published first; then **C-C** (policy and guard). Ordering matters: a policy applied before the frontend reads the view breaks the Marketplace listing.
6. **C-D** report, per-seller remediation on the owner's schedule.

## 9. Rollback

Each step is one migration with its own reverse (re-create the dropped policy from the captured definition; drop the trigger, function or view). Save the section 0 policy definitions as the rollback artefact before the first step. C-C's frontend change is reverted by re-publishing the previous frontend, which still works against the restored base-table policy.

## 10. Tests required before each step

Two real accounts plus anonymous, a staging database with the live definitions loaded. Roles: seller (owner), buyer with a paid order, buyer with a refunded order, unrelated authenticated user, anonymous, service role.

| Step | Must be refused | Must still work |
|---|---|---|
| C-A | any authenticated INSERT, UPDATE, DELETE on `digital_product_purchases` | buyer and seller SELECT; `complete-product-purchase` writes a row |
| C-B | buyer UPDATE of any column; seller UPDATE of `status`, `amount`, `escrow_released_at`; a backward delivery transition; refunded buyer restoring `status` | seller marks shipped with a tracking number; seller marks a service complete; `release-escrow` confirm and dispute; webhook order creation |
| C-C | anonymous or unrelated SELECT of `file_urls`; seller writing another seller's path into `file_urls` | listing pages; seller creating and editing their own product; delivery functions |

Plus, for every step: the purchase flow end to end in test mode (checkout, order row, download, email), and the 503 behaviour of the delivery functions when a lookup fails.

## 11. Estimated blast radius

- C-A: very low (no client use).
- C-B: low to medium (one UI component writes the table; the trigger fails closed with a message).
- C-C: medium (every Marketplace reader changes source). It is the only step that can break a public page.
- C-D, C-E: no schema change.

## 12. Not in scope

Refund and dispute policy; fee calculation; Stripe webhook handling beyond which paths are signed; the escrow auto-release job; moving existing legacy files; the payment/payout transition logic itself (it needs its own approved slice).
