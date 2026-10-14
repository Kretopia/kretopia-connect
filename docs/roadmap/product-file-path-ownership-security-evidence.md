# Product file path ownership: security evidence (Phase 1, one gate)

Status: **code complete in this PR; not merged, not deployed.** No migration, policy, secret or data change. The release is a manual paste into the Lovable project `kretopia-app`. Builds on PR #157 (entitlement) and is the same gate: *what a delivery function signs with the service role is something the buyer is entitled to.* Matrix rows 6 and 7 (GA SEC-09, SEC-15; CE p.33). Repository finding (code evidence); not reproduced against production.

## 1. The chain

Four facts, each visible in the repository, compose into one exploit:

| # | Fact | Evidence |
|---|---|---|
| 1 | Every active product is publicly selectable, all columns, so any visitor can read any seller's `file_urls` (storage paths such as `<seller id>/<name>`) | `digital_products` policy "Anyone can view active products" (`20251109022231`) |
| 2 | A seller writes `file_urls` on their own product with no validation of the paths | UPDATE policy `auth.uid() = user_id` (`20260217071053`), and the client sends the array as is |
| 3 | The private `product-files` bucket allows each user to read only their own folder, so the paths are not directly downloadable | `20260211153602` |
| 4 | The delivery functions sign every path of `file_urls` with the service role, which reads the whole bucket, with no check that the path belongs to the product's seller | `get-download-urls`, `complete-product-purchase`, `stripe-marketplace-webhook` |

Sequence: a malicious seller reads a victim's path from the public listing (fact 1), creates a cheap product whose `file_urls` names it (fact 2), buys it, and is handed a signed URL to the victim's paid file (fact 4). With PR #157 the buyer must really pay for their own product, but the price of that product is theirs to set.

## 2. Affected actor, object, action

- **Actor:** any seller, or a buyer colluding with one.
- **Object:** another seller's file in `product-files`.
- **Action:** obtain a signed URL (1 hour from `get-download-urls` and `complete-product-purchase`, 7 days from the webhook, which also stores it in the buyer-readable order row).

## 3. Rule now

The upload policy of `product-files` puts a seller's files under `<seller user id>/`. A path is deliverable for a product only when its first segment is that product's seller. Foreign folders, absolute paths, `.` / `..` / empty segments, backslashes, a path without a folder, a sibling folder that only starts with the seller id, non-strings and an unknown seller are refused and never signed. Absolute `http(s)` URLs (legacy data) are passed through unsigned, as before.

`_shared/productFilePaths.ts`: `classifyProductFile`, `deliverableProductFiles`.

## 4. Canonical records reused

`digital_products.user_id` (the seller) and the folder convention enforced by the bucket's own upload policy. No new table, field or policy.

## 5. Code paths changed

| File | Change |
|---|---|
| `_shared/productFilePaths.ts` (new) | pure rule |
| `get-download-urls` | both product reads also select `user_id` and are filtered before signing |
| `complete-product-purchase` | `filePaths` is filtered, so signing and the stored order paths are |
| `stripe-marketplace-webhook` | the signed list and the raw fallback are filtered. **Only which paths are signed changed**: no status, amount, fee or state transition |

## 6. Tests

`src/lib/__tests__/productFilePaths.test.ts`: 12 passing (owned path, nested path, another seller's folder, traversal and malformed paths, unknown seller, sibling-prefix folder, non-strings, external URLs; order preserved; wiring: the filter precedes every `createSignedUrl` and the raw column is no longer used). With `purchaseEntitlement.test.ts` from #157: 34 passing. ESLint clean.

After the paste, with sellers S (attacker) and V (victim), V's product P_V with file `V/paid.zip`, and S's product P_S with `file_urls = ["V/paid.zip"]`:

| Action | Expected |
|---|---|
| S's buyer buys P_S, then downloads | the foreign entry is skipped; **no URL for `V/paid.zip`** (an empty list, "No files available") |
| V's buyer downloads P_V | 200, signed URL for `V/paid.zip` |
| P_S with `file_urls = ["S/own.zip"]` | 200 |

## 7. Remaining gaps (not addressed here)

- **Fact 1 stays.** The public SELECT policy exposes `file_urls` of every active product. After this change a path alone is not a download, but it still reveals the seller's folder and file names; hiding paid-file columns from the public listing is a column-level policy or a view: Phase 2 (`schema-policy-impact-commerce.md`).
- **Legacy public-bucket products.** `AddDigitalProductDialog.tsx` (no importer today, so unreachable) uploaded paid files to the public `portfolio` bucket and stored their public URLs in `file_urls`. Such rows, if any exist, are downloadable by anyone and cannot be fixed by a function. Needs a read-only count in production.
- The webhook still persists 7-day signed URLs in `marketplace_orders.download_urls` (PR #157, F6).
- No validation when the seller writes `file_urls` (a write-time rule belongs with the policy proposal).

## 8. Rollback

Re-paste the previous version of the function. `_shared/productFilePaths.ts` can stay: nothing else imports it. Rolling back reopens the chain in section 1.

## 9. Release state (merged is not deployed)

| File | Paste order | State |
|---|---|---|
| `_shared/productFilePaths.ts` | first | not deployed |
| `get-download-urls`, `complete-product-purchase`, `stripe-marketplace-webhook` | after the helper, and after PR #157's files (they build on `_shared/purchaseEntitlement.ts`) | not deployed |

Checksums at this commit: `productFilePaths.ts` `fd06fb87129fdd326c1d32fb296df212d28bdeb5bc0c24e2296049015bc0210b`, `get-download-urls` `7bc97fe857ddc0bb49757edce35a1e2a7a50cb1757fd9227d5fcc1d5c8786a27`, `complete-product-purchase` `62eeb74d0593dda123fe3d7ed7e1981f653275f4158fda10354d9e5b9296c08b`, `stripe-marketplace-webhook` `ea568dcfcaf4d5f128149cac7993edbf92ebfbebac9f1a21469309bed0b42a01`.
