
-- ============== Recipient bank accounts ==============
CREATE TABLE IF NOT EXISTS public.recipient_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  label text NOT NULL,
  account_holder_name text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  routing_number text,
  swift_code text,
  branch text,
  country text NOT NULL DEFAULT 'TT',
  currency text NOT NULL DEFAULT 'TTD',
  instructions text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipient_bank_accounts_user ON public.recipient_bank_accounts(user_id);

ALTER TABLE public.recipient_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank accounts"
  ON public.recipient_bank_accounts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Senders view active bank accounts of recipient"
  ON public.recipient_bank_accounts FOR SELECT
  USING (is_active = true);

CREATE TRIGGER trg_recipient_bank_accounts_updated
  BEFORE UPDATE ON public.recipient_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== Reference code generator ==============
CREATE OR REPLACE FUNCTION public.generate_bank_transfer_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ref text;
  ref_exists boolean;
BEGIN
  LOOP
    new_ref := 'TH-BT-' || UPPER(SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 8));
    SELECT EXISTS(SELECT 1 FROM public.manual_bank_transfers WHERE reference_code = new_ref) INTO ref_exists;
    EXIT WHEN NOT ref_exists;
  END LOOP;
  RETURN new_ref;
END;
$$;

-- ============== Manual bank transfers ==============
CREATE TABLE IF NOT EXISTS public.manual_bank_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code text NOT NULL UNIQUE,
  payment_type text NOT NULL CHECK (payment_type IN ('wallet_topup', 'invoice_payment')),
  sender_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  recipient_bank_account_id uuid REFERENCES public.recipient_bank_accounts(id) ON DELETE SET NULL,
  recipient_bank_snapshot jsonb,
  invoice_id uuid,
  topup_id uuid REFERENCES public.wallet_topups(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'TTD',
  sender_bank_name text,
  sender_account_last4 text,
  transfer_date date,
  proof_url text NOT NULL,
  sender_notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','cancelled')),
  admin_notes text,
  confirmed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbt_status_created ON public.manual_bank_transfers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mbt_sender ON public.manual_bank_transfers(sender_id);
CREATE INDEX IF NOT EXISTS idx_mbt_recipient ON public.manual_bank_transfers(recipient_id);
CREATE INDEX IF NOT EXISTS idx_mbt_invoice ON public.manual_bank_transfers(invoice_id);

ALTER TABLE public.manual_bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_mbt_set_reference
  BEFORE INSERT ON public.manual_bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.set_bank_transfer_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_code IS NULL OR NEW.reference_code = '' THEN
    NEW.reference_code := public.generate_bank_transfer_reference();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mbt_set_reference ON public.manual_bank_transfers;
CREATE TRIGGER trg_mbt_set_reference
  BEFORE INSERT ON public.manual_bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.set_bank_transfer_reference();

CREATE TRIGGER trg_mbt_updated
  BEFORE UPDATE ON public.manual_bank_transfers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== RLS policies =====
CREATE POLICY "Senders create own transfers"
  ON public.manual_bank_transfers FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Senders view own transfers"
  ON public.manual_bank_transfers FOR SELECT
  USING (auth.uid() = sender_id);

CREATE POLICY "Recipients view incoming transfers"
  ON public.manual_bank_transfers FOR SELECT
  USING (auth.uid() = recipient_id);

CREATE POLICY "Senders cancel own pending transfers"
  ON public.manual_bank_transfers FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'pending')
  WITH CHECK (auth.uid() = sender_id AND status IN ('pending','cancelled'));

CREATE POLICY "Admins view all transfers"
  ON public.manual_bank_transfers FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update transfers"
  ON public.manual_bank_transfers FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============== Storage bucket for proofs ==============
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins read all payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============== Confirm transfer RPC (admin) ==============
CREATE OR REPLACE FUNCTION public.admin_confirm_bank_transfer(
  p_transfer_id uuid,
  p_admin_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can confirm transfers';
  END IF;

  SELECT * INTO v_transfer FROM public.manual_bank_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status <> 'pending' THEN RAISE EXCEPTION 'Transfer already %', v_transfer.status; END IF;

  UPDATE public.manual_bank_transfers
  SET status='confirmed', confirmed_by=auth.uid(), confirmed_at=now(), admin_notes=COALESCE(p_admin_notes, admin_notes)
  WHERE id = p_transfer_id;

  -- Credit wallet top-up
  IF v_transfer.payment_type = 'wallet_topup' AND v_transfer.topup_id IS NOT NULL THEN
    UPDATE public.wallet_topups
    SET status='completed', completed_at=now()
    WHERE id = v_transfer.topup_id;

    UPDATE public.wallets
    SET credits = credits + v_transfer.amount, updated_at = now()
    WHERE user_id = v_transfer.sender_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_bank_transfer(
  p_transfer_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_transfer RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can reject transfers';
  END IF;

  SELECT * INTO v_transfer FROM public.manual_bank_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_transfer.status <> 'pending' THEN RAISE EXCEPTION 'Transfer already %', v_transfer.status; END IF;

  UPDATE public.manual_bank_transfers
  SET status='rejected', confirmed_by=auth.uid(), confirmed_at=now(), rejected_reason=p_reason
  WHERE id = p_transfer_id;

  IF v_transfer.payment_type = 'wallet_topup' AND v_transfer.topup_id IS NOT NULL THEN
    UPDATE public.wallet_topups SET status='failed' WHERE id = v_transfer.topup_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'transfer_id', p_transfer_id);
END;
$$;
