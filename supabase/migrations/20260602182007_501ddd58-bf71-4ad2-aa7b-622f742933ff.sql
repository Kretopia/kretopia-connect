
-- Payment Links: shareable URLs to receive money
CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'open' CHECK (mode IN ('fixed','open','suggested')),
  amount_cents integer,                -- required when mode='fixed' or 'suggested'
  min_amount_cents integer DEFAULT 100,
  max_amount_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  single_use boolean NOT NULL DEFAULT false,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  cover_image_url text,
  success_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_paid_at timestamptz
);

CREATE INDEX idx_payment_links_user ON public.payment_links(user_id);
CREATE INDEX idx_payment_links_slug ON public.payment_links(slug) WHERE active = true;

GRANT SELECT ON public.payment_links TO anon;              -- public pay page needs to read by slug
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;

ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Public can SELECT only active links (used by the public /pay/:slug page)
CREATE POLICY "Active payment links are publicly viewable"
  ON public.payment_links FOR SELECT
  USING (active = true);

CREATE POLICY "Users manage their own payment links insert"
  ON public.payment_links FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage their own payment links update"
  ON public.payment_links FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own payment links"
  ON public.payment_links FOR DELETE
  USING (auth.uid() = user_id);

-- Payment Link Payments: log of successful payments through links
CREATE TABLE public.payment_link_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_id uuid NOT NULL REFERENCES public.payment_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,              -- recipient (link owner)
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payer_email text,
  payer_name text,
  payer_note text,
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pl_payments_link ON public.payment_link_payments(payment_link_id);
CREATE INDEX idx_pl_payments_user ON public.payment_link_payments(user_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_link_payments TO authenticated;
GRANT ALL ON public.payment_link_payments TO service_role;

ALTER TABLE public.payment_link_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their link payments"
  ON public.payment_link_payments FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
