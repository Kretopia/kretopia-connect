# Signed URL issuers: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`, like the meeting slices.

Gate: *a function that hands out a signed URL proves current entitlement from a record the requester cannot write, and the URL is short-lived.* Matrix row 7 (GA SEC-09, SEC-10; CE p.33), row 14 for the provider-confirmed half. The findings below are repository findings (code evidence); none was reproduced against production.

## 1. What was reviewed

Every edge function that calls `createSignedUrl` (6 files). `redeem-project-share` was fixed separately (PR #156). The other five:

| Function | Who is handed a URL | Finding | Change |
|---|---|---|---|
| `get-download-urls` | a buyer of a product | **F1.** The `productId` branch accepted any row of `digital_product_purchases`, a table the buyer can INSERT into (`Users can create purchases`, `auth.uid() = buyer_id`, migration `20251109022231`), with any `payment_status`. Any signed-in user could write a row and download any product's files for free. **F2.** The `orderId` branch selected `status` and never read it: pending, refunded and disputed orders downloaded like completed ones | F1: a legacy row counts only when `payment_status = completed` **and** the payment provider confirms the intent as `succeeded`, not refunded, with metadata naming this product and this buyer; failed provider lookup answers 503. F2: only `completed` and `escrow` entitle |
| `complete-product-purchase` | the caller, after a paid checkout | **F3.** The paid session was never bound to `productId`: a buyer who paid for a cheap product could complete an expensive one with the same session (first completion of that session wins). The buyer check was skipped when the session metadata had no `buyer_id`, and any paid session type (ticket, invoice, milestone) was accepted | The session's own server-written metadata must say `type = marketplace_purchase`, this product, this buyer. A missing field is a refusal |
| `generate-studio-image` | a project member (preview URL, plus an asset write and quota spend) | **F4.** Access was "any `project_collaborators` row": pending invitees, guests and clients passed | `requireProjectAccess` with roles owner, collaborator, creative; 503 on failed lookup; before the quota is consumed and before the model is called |
| `generate-deal-memo` | the gig poster only (already checked) | **F5.** A 7-day link, opened immediately by the only caller | 1 hour |
| `stripe-marketplace-webhook` | persists links in `marketplace_orders.download_urls` | **F6.** Stores 7-day signed URLs in the row | **Not changed** (payment webhook, see section 6) |

## 2. Affected actor, object, action

- **Any authenticated user** (F1): `digital_product_purchases` INSERT, then `get-download-urls` with `productId`.
- **A paying buyer** (F3): reuse a paid session id for a different `productId`.
- **A buyer with a refunded or pending order** (F2).
- **A pending invitee, guest or client of a project** (F4): `generate-studio-image`.

## 3. Rules now

| Question | Rule |
|---|---|
| Order download | buyer, and `status` in (`completed`, `escrow`) |
| Product download | an entitling order, **or** a legacy purchase row that the payment provider confirms for this product and this buyer |
| Complete a purchase | the session is a `marketplace_purchase` of this product by this user |
| Generate an image | owner or an accepted collaborator / creative |
| Deal memo link | 1 hour |

## 4. Canonical records reused

`marketplace_orders` (system-written; there is no INSERT policy), the payment provider (for legacy rows), the checkout session metadata written by `purchase-digital-product`, `projects.created_by` and accepted `project_collaborators` through `_shared/projectAccess.ts`. No new table, field or policy.

## 5. Tests

`src/lib/__tests__/purchaseEntitlement.test.ts`: 22 passing. Roles here are the requester's standing: buyer with a completed, escrow, pending, refunded or disputed order; forged purchase row (no intent, not completed, unknown intent, wrong product, wrong buyer, refunded, no metadata, lookup failure); session of this product, another product, another type, another buyer, missing buyer, missing product. The wiring tests check the order of operations in the four functions (decision before any signed URL, order write, quota spend or model call).

After the paste, with two accounts A (buyer) and B (unrelated), a paid digital product P and an unpaid digital product Q:

| Action | Expected |
|---|---|
| A: download P by order | 200 |
| B: insert a `digital_product_purchases` row for Q (own `buyer_id`), then download Q by `productId` | **403** |
| A: complete the session paid for P, with `productId` = Q | **403** |
| A: complete the session paid for P, with `productId` = P | 200 (or the existing order, as before) |
| A: order set to `refunded`, download | **403** |
| pending invitee or accepted guest: generate image | **403** |
| accepted creative: generate image | 200 |

## 6. Remaining gaps (not addressed here)

- **SQL half of F1.** The INSERT policy on `digital_product_purchases` still exists; this PR stops the function from trusting the row, it does not remove the write. Needs a policy proposal (Phase 2): revoke client INSERT, since the only legitimate writer is `complete-product-purchase` with the service role.
- **Buyer-writable order state.** `marketplace_orders` has UPDATE policies for the buyer (`auth.uid() = buyer_id`) and for the seller with no column restriction, so a refunded buyer can write `status` back to `completed`, and a seller can write `status`, `amount` or `escrow_released_at`. Payment state truth (matrix row 14); needs a column guard and its own approved slice. The status check added here is therefore a defence in depth, not the boundary.
- **F6.** `stripe-marketplace-webhook` persists 7-day signed URLs (and falls back to raw paths) in `marketplace_orders.download_urls`; `complete-product-purchase` stores raw paths. Left alone: it is the payment webhook, and the success page reads that column. Fix is to store paths and sign on demand; needs the existing-order path of `complete-product-purchase` to sign fresh URLs at the same time.
- **Legacy buyers without provider metadata.** A purchase made before the checkout carried `product_id` and `buyer_id` metadata is refused by the new rule. Not measurable from here (no production access). Rollback below if support reports it.
- The same "any `project_collaborators` row" membership test may exist in other Studio generators (`generate-studio-copy`, `generate-board-image`, `thrive-document-engine`); not inventoried in this PR.
- Download links in the purchase email say they expire in 7 days; they last 1 hour. Copy only.

## 7. Rollback

Re-paste the previous version of the changed function. `_shared/purchaseEntitlement.ts` can stay: nothing else imports it. Rolling back `get-download-urls` reopens F1.

## 8. Release state (merged is not deployed)

| Function | Paste order | State |
|---|---|---|
| `_shared/purchaseEntitlement.ts` | first | not deployed |
| `get-download-urls`, `complete-product-purchase`, `generate-studio-image`, `generate-deal-memo` | after the helper | not deployed |

Dependencies to confirm in `kretopia-app` before pasting (checklist step 1.5b): `get-download-urls` now imports `https://esm.sh/stripe@18.5.0` and `_shared/stripeEnv.ts` (`complete-product-purchase` already imports both, so they should exist, but `kretopia-app` was not read for this slice); `generate-studio-image` imports `_shared/projectAccess.ts` (read on 2026-10-13: present and equivalent to `main`).

Checksums at this commit: `purchaseEntitlement.ts` `daed89fdad1f3d2260394b4ba3f5a5472ed8da0294d1c4a042cc632a6a831ed7`, `get-download-urls` `526c08eba20c9ce8b88e688cb5edf441461539bdc4dcbd14a44ef72717fccd44`, `complete-product-purchase` `64043e20548837c7e12fa518defd2943f072d6a980d7e22eee93958fac0dafbb`, `generate-studio-image` `90ae0b16673f8bfb0778ceae0e0644698fe6f23f863abe8a863e878a55211058`, `generate-deal-memo` `a3a5aa714c1261ea119ec2a4a181589377935d5b4a57edf2417c58234083e58f`.
