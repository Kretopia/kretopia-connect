-- Raised hands queue (audience → "Pull me up" requests)
CREATE TYPE public.curated_raised_hand_status AS ENUM ('pending', 'promoted', 'dismissed');

CREATE TABLE public.curated_stage_raised_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.curated_raised_hand_status NOT NULL DEFAULT 'pending',
  promoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage_id, user_id)
);

CREATE INDEX idx_curated_hands_stage ON public.curated_stage_raised_hands(stage_id);
CREATE INDEX idx_curated_hands_status ON public.curated_stage_raised_hands(status);

ALTER TABLE public.curated_stage_raised_hands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User raises own hand"
ON public.curated_stage_raised_hands FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "User cancels own hand"
ON public.curated_stage_raised_hands FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "User sees own or host sees all"
ON public.curated_stage_raised_hands FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = curated_stage_raised_hands.stage_id
      AND s.host_user_id = auth.uid()
  )
);

CREATE POLICY "Host updates hands"
ON public.curated_stage_raised_hands FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = curated_stage_raised_hands.stage_id
      AND s.host_user_id = auth.uid()
  )
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.curated_stage_raised_hands;
ALTER TABLE public.curated_stage_raised_hands REPLICA IDENTITY FULL;

-- Stage ticket orders (paid stages)
CREATE TYPE public.curated_stage_order_status AS ENUM ('pending', 'paid', 'refunded', 'failed');

CREATE TABLE public.curated_stage_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_session_id text UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status public.curated_stage_order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX idx_stage_orders_stage ON public.curated_stage_orders(stage_id);
CREATE INDEX idx_stage_orders_user ON public.curated_stage_orders(user_id);
CREATE INDEX idx_stage_orders_session ON public.curated_stage_orders(stripe_session_id);

ALTER TABLE public.curated_stage_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User sees own orders or host sees stage orders"
ON public.curated_stage_orders FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.curated_stages s
    WHERE s.id = curated_stage_orders.stage_id
      AND s.host_user_id = auth.uid()
  )
);
-- Orders are inserted server-side only (service role from edge fn)