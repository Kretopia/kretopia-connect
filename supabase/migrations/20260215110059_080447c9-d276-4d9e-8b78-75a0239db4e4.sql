
-- Add branding, payment, tracking, and T&C fields to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_address TEXT,
  ADD COLUMN IF NOT EXISTS brand_email TEXT,
  ADD COLUMN IF NOT EXISTS brand_website TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_address TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_link_url TEXT,
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS discount_type TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.payment_method IS 'thrivepay, bank_transfer, paypal, crypto, other';
COMMENT ON COLUMN public.invoices.payment_details IS 'Bank details, PayPal email, crypto address, etc as JSON';
COMMENT ON COLUMN public.invoices.discount_type IS 'percentage or fixed';
