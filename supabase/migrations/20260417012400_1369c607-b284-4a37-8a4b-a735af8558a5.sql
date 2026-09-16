CREATE TABLE IF NOT EXISTS public.saved_creator_searches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  query TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts_enabled BOOLEAN NOT NULL DEFAULT false,
  last_alert_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_creator_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own saved searches" ON public.saved_creator_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own saved searches" ON public.saved_creator_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own saved searches" ON public.saved_creator_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own saved searches" ON public.saved_creator_searches FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_creator_searches_user ON public.saved_creator_searches(user_id);

CREATE TRIGGER update_saved_creator_searches_updated_at
BEFORE UPDATE ON public.saved_creator_searches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();