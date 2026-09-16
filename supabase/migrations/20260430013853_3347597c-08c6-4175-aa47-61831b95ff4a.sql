CREATE POLICY "Recipients read incoming payment proofs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.manual_bank_transfers mbt
    WHERE mbt.proof_url LIKE '%' || storage.objects.name
      AND mbt.recipient_id = auth.uid()
  )
);

CREATE POLICY "Invoice issuer confirms own invoice transfers"
ON public.manual_bank_transfers
FOR UPDATE
TO authenticated
USING (
  invoice_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = manual_bank_transfers.invoice_id
      AND i.issued_by = auth.uid()
  )
)
WITH CHECK (
  invoice_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = manual_bank_transfers.invoice_id
      AND i.issued_by = auth.uid()
  )
);

CREATE POLICY "Invoice issuer views own invoice transfers"
ON public.manual_bank_transfers
FOR SELECT
TO authenticated
USING (
  invoice_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = manual_bank_transfers.invoice_id
      AND i.issued_by = auth.uid()
  )
);