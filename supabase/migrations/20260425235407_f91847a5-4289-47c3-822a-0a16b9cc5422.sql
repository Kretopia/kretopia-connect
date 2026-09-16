CREATE TABLE public.creator_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rate_type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  amount_max NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  unit TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT creator_rates_visibility_check CHECK (visibility IN ('public','connections','on_request')),
  CONSTRAINT creator_rates_amount_positive CHECK (amount >= 0)
);

CREATE INDEX idx_creator_rates_user ON public.creator_rates(user_id, sort_order);

ALTER TABLE public.creator_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their rates"
  ON public.creator_rates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public rates viewable by all"
  ON public.creator_rates FOR SELECT
  USING (visibility = 'public' AND is_active = true);

CREATE POLICY "Connection rates viewable by connections"
  ON public.creator_rates FOR SELECT
  USING (
    visibility = 'connections'
    AND is_active = true
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.status = 'accepted'
        AND (
          (c.user_id = auth.uid() AND c.connected_user_id = creator_rates.user_id)
          OR (c.connected_user_id = auth.uid() AND c.user_id = creator_rates.user_id)
        )
    )
  );

CREATE POLICY "On-request rate metadata viewable"
  ON public.creator_rates FOR SELECT
  USING (visibility = 'on_request' AND is_active = true);

CREATE TRIGGER trg_creator_rates_updated_at
  BEFORE UPDATE ON public.creator_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();