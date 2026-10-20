# KrePay: proof of payment (design only, v1)

Status: design. Nothing here is built, no UI, no backend, no migration. It does not touch Stripe, Xendit, any bank integration or any real money flow.

## What this is
A way to attach **evidence that a payment happened outside Kretopia** to the project, the client and the creative it belongs to, and to have that evidence checked as a document. It is not a payment processor and not a ledger.

## What exists today (read before building anything new)
- A private storage bucket `payment-proofs`, with policies for the uploader, the recipient and admins to read, and for a user to upload. It is empty.
- A table `manual_bank_transfers`: reference code, sender and recipient, optional invoice, amount, currency, transfer date, last 4 digits of the sender's account, `proof_url`, `status`, admin notes, who confirmed and when, rejected reason. It is empty.
- An admin screen (`BankTransfersTab`) and a project dialog (`MarkPaidBankTransferDialog`) that were built for this.
- `confirm_milestone_paid_offline`, which lets the owner or the client mark a milestone paid by hand, without any document.
- `invoices.bank_transfer_reported_at`.

The first job of the build is to check whether these already cover v1 (the status values need reading from the table's check constraint). Only what they cannot express would be new.

## The flow
1. **Upload.** Either party on a project (the client who paid, or the creative who was paid) adds one or more of: an invoice, a receipt, a bank confirmation (screenshot or PDF), or a transaction reference (text). The upload names the project, the milestone or invoice it concerns, the amount and currency, the date, and who paid whom.
2. **Store and link.** Kretopia stores the file privately and links it to the project, the client and the creative. The link is the record; the file is never public.
3. **Check.** The other party sees the proof and answers: it matches what they received, or it does not. An admin can review when the two disagree or when asked.
4. **Outcome.** The proof ends as Verified or Rejected (with a reason). The milestone's own "paid" state is not changed automatically.

## Statuses
| Status | Meaning |
|---|---|
| Uploaded | A document was added; nobody has looked yet. |
| Under review | The other party or an admin is checking it. |
| Verified | The document was checked and accepted as evidence that the payment described happened. |
| Rejected | It was checked and not accepted; a reason is required and shown to the uploader, who can add a corrected one. |

**Verified means the document was checked.** It does not mean Kretopia received, held, moved or guaranteed any funds, and the interface must not say "payment confirmed" or "paid by Kretopia". Suggested wording: "Proof verified".

## Privacy
- Only authorised participants of the project can see a proof: the two parties it names, the project owner, and admins acting on a review or a dispute. Collaborators who are not party to the payment cannot.
- Private bucket, access by short-lived signed link, never a public URL. Files are not indexed, not embedded in public pages, not included in a Passport or in exports for third parties.
- Ask the uploader to hide account numbers, keeping only the last 4 digits, before upload. Show this next to the upload button.
- Delete on request of the uploader while still Uploaded; after Verified, keep for the retention period the owner sets, then delete. The retention period is an open question below.
- Every view, upload, status change and removal is recorded with who and when (the audit trail in `docs/platform/AUDIT_TRAIL_DESIGN.md`).

## Out of scope in v1, on purpose
- **No funds handled by Kretopia.** No holding, no splitting, no payout, no refund.
- **No automatic financial reconciliation.** Nothing compares a proof to a bank feed, matches amounts automatically, or flips an invoice or milestone to paid on its own. A person marks the milestone paid, as today.
- No OCR or AI reading of documents, and no AI verdict on whether a document is genuine. A document can be forged; v1 relies on the counterparty's confirmation, not on a machine.
- No new payment provider, no new currency handling, no tax or accounting export.

## Abuse and failure cases to design for
- A forged or edited proof: it can only become Verified with the other party's confirmation or an admin's decision; a lone upload stays Uploaded and is shown as such.
- The two parties disagree: the proof stays Under review and the existing dispute path applies.
- A proof uploaded to the wrong project: the uploader can withdraw it while it is Uploaded.
- Large or unsafe files: allow PDF, PNG and JPEG only, with a size cap, and scan or at least type-check on the server.
- Repeated uploads: cap per project and per hour.

## Interface notes (for later)
- On the milestone and the invoice: one "Proof of payment" row showing the status chip, who uploaded, and the date. The same four words everywhere.
- The creative sees proofs on their own payments; the client sees the ones they uploaded or are asked to confirm.
- Empty state: "No proof added" with the upload action; never a placeholder or sample document.

## Open questions for the owner
1. Who is the default reviewer: the counterparty alone, or always an admin as well?
2. Retention period for Verified proofs.
3. Is a bare transaction reference (no file) enough to reach Verified, or only to reach Under review?
4. Does the existing `manual_bank_transfers.status` list already have these four values?
5. Which currencies and countries are in scope for v1.
