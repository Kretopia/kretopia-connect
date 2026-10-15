-- invoices: the provider reference the Stripe webhook already writes, and a guard so a
-- client cannot insert an invoice that is already paid or already carries one.
--
-- READ BEFORE APPLYING. Not applied by anyone: this file is a reviewed proposal in a PR.
--
-- Why
--   * Production has no `invoices.stripe_payment_intent_id` (checked read-only on 2026-10-15).
--     `stripe-marketplace-webhook` writes it in the same UPDATE that sets status = 'paid', so
--     that UPDATE fails and the invoice stays unpaid although Stripe was paid; the failure was
--     not checked. The column is what the code already expects.
--   * With the column, a provider-confirmed paid invoice is distinguishable from one the issuer
--     confirmed themselves (confirm_invoice_paid_manually). That is what lets public trust
--     signals count only provider-confirmed invoices.
--   * The UPDATE side is already closed (20260904180000: column-level UPDATE grants, status and
--     paid_at excluded; the new column is not granted). The INSERT policy only checks
--     issued_by and project access, so a project member could INSERT a row with status 'paid',
--     a paid_at and, once the column exists, a made-up provider reference. The trigger below
--     closes that for the API roles; the service role and SECURITY DEFINER functions are unaffected.
--
-- Safe order: apply this, then paste the webhook, then publish the frontend. Applying it alone
-- changes no behaviour a user can see.
-- Rollback: drop the trigger and its function; the column can stay (nullable, unused by clients).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Belt and braces: no client may write it, whatever the grants drift to.
REVOKE UPDATE (stripe_payment_intent_id) ON public.invoices FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.invoices_block_client_paid_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only API callers are held to this: auth.role() is 'authenticated' or 'anon' for them,
  -- 'service_role' for the webhook and the edge functions, and null for the SQL editor.
  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon')
     AND (
       NEW.status = 'paid'
       OR NEW.paid_at IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'An invoice cannot be created as paid'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_block_client_paid_insert ON public.invoices;
CREATE TRIGGER trg_invoices_block_client_paid_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invoices_block_client_paid_insert();
