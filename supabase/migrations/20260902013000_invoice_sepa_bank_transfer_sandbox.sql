-- Sandbox manual-SEPA invoice extension.
-- Additive only: new table + one new nullable column on invoices. No existing
-- Stripe flow, RLS policy, or column is touched. Follows the exact security
-- pattern already established for confirm_invoice_paid_manually /
-- confirm_milestone_paid_offline (SECURITY DEFINER RPC, no direct client
-- table writes) rather than inventing a new authorization style.
--
-- Money never moves through Kretopia for this flow -- a client sends a SEPA
-- credit transfer directly to the issuing creator's own bank account. This
-- table stores that creator's own beneficiary details for display on their
-- own invoices' payment pages, nothing more.
--
-- NOT applied automatically. Run manually via `supabase db push` (or your
-- project's normal migration process) only when you're ready to test this
-- in a real Supabase environment.

CREATE TABLE IF NOT EXISTS public.invoice_sepa_beneficiaries (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  beneficiary_name text NOT NULL,
  iban text NOT NULL,
  bic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_sepa_beneficiaries ENABLE ROW LEVEL SECURITY;

-- Owner can read their own row (to show "already configured" state in their
-- own settings UI). No anon policy at all -- the public invoice-pay-info
-- edge function reads this via the service-role key and returns only the
-- three display fields it actually needs, the same pattern invoice-pay-info
-- already uses for the invoices table itself.
CREATE POLICY "Users can view own SEPA beneficiary details"
  ON public.invoice_sepa_beneficiaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE policy for any client role. Writes go
-- exclusively through set_invoice_sepa_beneficiary below, matching this
-- codebase's established pattern for every other money-adjacent write.

REVOKE ALL ON public.invoice_sepa_beneficiaries FROM anon;
GRANT SELECT ON public.invoice_sepa_beneficiaries TO authenticated;
GRANT ALL ON public.invoice_sepa_beneficiaries TO service_role;

CREATE OR REPLACE FUNCTION public.set_invoice_sepa_beneficiary(
  p_beneficiary_name text,
  p_iban text,
  p_bic text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_iban text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_beneficiary_name IS NULL OR length(trim(p_beneficiary_name)) = 0 THEN
    RAISE EXCEPTION 'Beneficiary name is required';
  END IF;

  -- Basic SEPA IBAN shape check (country code + 2 check digits + up to 30
  -- alphanumeric BBAN chars, spaces stripped). This is a format check only --
  -- it does not verify the IBAN belongs to a real, existing account. Real
  -- verification (if ever required) is a provider/compliance decision, not
  -- something this sandbox function attempts.
  v_iban := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  IF v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' THEN
    RAISE EXCEPTION 'That doesn''t look like a valid IBAN';
  END IF;
  -- SEPA-zone country codes only, matching the countries wallet-add-bank
  -- already validates for (DE/FR/NL/ES) plus the rest of the Eurozone --
  -- this sandbox extension is EUR/SEPA-only by design, not a general bank-
  -- transfer feature for arbitrary countries.
  IF left(v_iban, 2) NOT IN (
    'AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT',
    'LT','LU','LV','MT','NL','PT','SI','SK'
  ) THEN
    RAISE EXCEPTION 'This sandbox flow supports SEPA/Eurozone IBANs only';
  END IF;

  INSERT INTO public.invoice_sepa_beneficiaries (user_id, beneficiary_name, iban, bic, updated_at)
  VALUES (auth.uid(), trim(p_beneficiary_name), v_iban, nullif(trim(coalesce(p_bic, '')), ''), now())
  ON CONFLICT (user_id) DO UPDATE
  SET beneficiary_name = excluded.beneficiary_name,
      iban = excluded.iban,
      bic = excluded.bic,
      updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_invoice_sepa_beneficiary(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_sepa_beneficiary(text, text, text) TO authenticated;

-- Distinct from `status`/`paid_at` (already locked down for direct client
-- write by migration 20260812071205). This column is additive and separate
-- on purpose: a client reporting "I sent the transfer" must never look like
-- or feed into the actual `paid` state. Only confirm_invoice_paid_manually
-- (issuer-only, already audited) can ever set status = 'paid'.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS bank_transfer_reported_at timestamptz;

REVOKE UPDATE (bank_transfer_reported_at) ON public.invoices FROM authenticated, anon;
GRANT ALL ON public.invoices TO service_role;
