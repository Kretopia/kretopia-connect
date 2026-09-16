
-- ============================================================
-- EXTEND creative_jams (additive only)
-- ============================================================
ALTER TABLE public.creative_jams
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refund_policy text,
  ADD COLUMN IF NOT EXISTS total_views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS host_response_hours numeric,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS is_recurring_parent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES public.creative_jams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timezone text;

CREATE INDEX IF NOT EXISTS idx_creative_jams_country ON public.creative_jams(country);
CREATE INDEX IF NOT EXISTS idx_creative_jams_parent ON public.creative_jams(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_creative_jams_start_time ON public.creative_jams(start_time);

-- ============================================================
-- TICKET TIERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  quantity_total integer,
  quantity_sold integer NOT NULL DEFAULT 0,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  min_per_order integer NOT NULL DEFAULT 1,
  max_per_order integer NOT NULL DEFAULT 10,
  is_hidden boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON public.event_ticket_tiers(event_id);
ALTER TABLE public.event_ticket_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view tiers for public events"
  ON public.event_ticket_tiers FOR SELECT
  USING (
    NOT is_hidden AND EXISTS (
      SELECT 1 FROM public.creative_jams cj
      WHERE cj.id = event_id AND cj.is_public = true
    )
  );

CREATE POLICY "Hosts can view all their event tiers"
  ON public.event_ticket_tiers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid())
  );

CREATE POLICY "Hosts can manage their event tiers"
  ON public.event_ticket_tiers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE TRIGGER trg_ticket_tiers_updated_at
  BEFORE UPDATE ON public.event_ticket_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PROMO CODES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL,
  max_uses integer,
  uses_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  applies_to_tier_ids uuid[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_event ON public.event_promo_codes(event_id);
ALTER TABLE public.event_promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their promo codes"
  ON public.event_promo_codes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE TRIGGER trg_promo_codes_updated_at
  BEFORE UPDATE ON public.event_promo_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  buyer_email text NOT NULL,
  buyer_name text,
  tier_id uuid REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  discount_amount numeric NOT NULL DEFAULT 0,
  promo_code_id uuid REFERENCES public.event_promo_codes(id) ON DELETE SET NULL,
  platform_fee numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','cancelled','failed')),
  refunded_at timestamptz,
  refund_amount numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_event ON public.event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON public.event_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON public.event_orders(stripe_session_id);
ALTER TABLE public.event_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers view own orders"
  ON public.event_orders FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "Hosts view orders for their events"
  ON public.event_orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.event_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- WAITLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tier_id uuid REFERENCES public.event_ticket_tiers(id) ON DELETE SET NULL,
  position integer NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','converted','expired','cancelled')),
  offered_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_event ON public.event_waitlist(event_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON public.event_waitlist(user_id);
ALTER TABLE public.event_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own waitlist entries"
  ON public.event_waitlist FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users join waitlist"
  ON public.event_waitlist FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users cancel own waitlist"
  ON public.event_waitlist FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Hosts view their event waitlist"
  ON public.event_waitlist FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE POLICY "Hosts update their event waitlist"
  ON public.event_waitlist FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

-- ============================================================
-- BLASTS (email campaigns to attendees)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  template text NOT NULL DEFAULT 'custom' CHECK (template IN ('announcement','reminder_24h','day_of','thank_you','feedback','cancellation','custom')),
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  segment text NOT NULL DEFAULT 'all' CHECK (segment IN ('all','rsvp','paid','waitlist','checked_in','no_show','interested')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','failed','cancelled')),
  recipient_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blasts_event ON public.event_blasts(event_id);
CREATE INDEX IF NOT EXISTS idx_blasts_scheduled ON public.event_blasts(scheduled_for) WHERE status = 'scheduled';
ALTER TABLE public.event_blasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their event blasts"
  ON public.event_blasts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE TRIGGER trg_blasts_updated_at
  BEFORE UPDATE ON public.event_blasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BLAST RECIPIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_blast_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blast_id uuid NOT NULL REFERENCES public.event_blasts(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','opened','clicked','bounced','failed','unsubscribed')),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blast_recipients_blast ON public.event_blast_recipients(blast_id);
CREATE INDEX IF NOT EXISTS idx_blast_recipients_email ON public.event_blast_recipients(email);
ALTER TABLE public.event_blast_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts view their blast recipients"
  ON public.event_blast_recipients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.event_blasts b
    JOIN public.creative_jams cj ON cj.id = b.event_id
    WHERE b.id = blast_id AND cj.created_by = auth.uid()
  ));

-- ============================================================
-- ANALYTICS EVENTS (lightweight funnel tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_analytics_event ON public.event_analytics_events(event_id, event_type);
CREATE INDEX IF NOT EXISTS idx_event_analytics_created ON public.event_analytics_events(created_at);
ALTER TABLE public.event_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log analytics events"
  ON public.event_analytics_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Hosts view their event analytics"
  ON public.event_analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

-- ============================================================
-- HOST STATS (reputation aggregate)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_host_stats (
  user_id uuid PRIMARY KEY,
  events_hosted integer NOT NULL DEFAULT 0,
  events_completed integer NOT NULL DEFAULT 0,
  total_attendees integer NOT NULL DEFAULT 0,
  avg_attendance_pct numeric NOT NULL DEFAULT 0,
  avg_rating numeric NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  avg_response_hours numeric,
  is_verified_host boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_host_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view host stats"
  ON public.event_host_stats FOR SELECT
  USING (true);

CREATE POLICY "Users view own host stats"
  ON public.event_host_stats FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  would_recommend boolean,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_event ON public.event_feedback(event_id);
ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public feedback"
  ON public.event_feedback FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users manage own feedback"
  ON public.event_feedback FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Hosts view all their event feedback"
  ON public.event_feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_id AND cj.created_by = auth.uid()));

CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON public.event_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
