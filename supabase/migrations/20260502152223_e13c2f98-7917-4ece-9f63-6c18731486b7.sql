CREATE TABLE IF NOT EXISTS public.copilot_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','running','completed','failed','cancelled')),
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_step INTEGER NOT NULL DEFAULT 0,
  summary TEXT,
  surface TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_copilot_plans_user_status ON public.copilot_plans (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_copilot_plans_project ON public.copilot_plans (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE public.copilot_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own plans"
  ON public.copilot_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own plans"
  ON public.copilot_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own plans"
  ON public.copilot_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own plans"
  ON public.copilot_plans FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_copilot_plans_updated
  BEFORE UPDATE ON public.copilot_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();