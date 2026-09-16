CREATE TABLE IF NOT EXISTS public.curated_stage_reminders_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.curated_stages(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('24h','1h','15m')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(stage_id, kind)
);

ALTER TABLE public.curated_stage_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role manages reminders" ON public.curated_stage_reminders_sent
  FOR ALL TO service_role USING (true) WITH CHECK (true);