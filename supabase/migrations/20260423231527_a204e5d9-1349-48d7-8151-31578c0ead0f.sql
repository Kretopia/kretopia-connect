-- 1. Add last-scan timestamp to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_universe_scan_at TIMESTAMPTZ;

-- 2. discovery_scans: one row per scan run
CREATE TABLE IF NOT EXISTS public.discovery_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed
  trigger_source TEXT NOT NULL DEFAULT 'manual', -- manual | cron | onboarding
  query_used TEXT,
  total_candidates INT NOT NULL DEFAULT 0,
  new_credits INT NOT NULL DEFAULT 0,
  new_press INT NOT NULL DEFAULT 0,
  new_awards INT NOT NULL DEFAULT 0,
  new_uploads INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_scans_user_started
  ON public.discovery_scans(user_id, started_at DESC);

ALTER TABLE public.discovery_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their own scans"
  ON public.discovery_scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can create scans for themselves"
  ON public.discovery_scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. pending_discoveries: inbox of new items awaiting review
CREATE TABLE IF NOT EXISTS public.pending_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scan_id UUID REFERENCES public.discovery_scans(id) ON DELETE SET NULL,
  kind TEXT NOT NULL, -- credit | press | award | upload
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_domain TEXT,
  thumbnail_url TEXT,
  excerpt TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL, -- normalized identity (e.g., kind + sourceId or kind + url)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | dismissed
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_pending_discoveries_user_status
  ON public.pending_discoveries(user_id, status, created_at DESC);

ALTER TABLE public.pending_discoveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their pending discoveries"
  ON public.pending_discoveries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can update their pending discoveries"
  ON public.pending_discoveries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete their pending discoveries"
  ON public.pending_discoveries FOR DELETE
  USING (auth.uid() = user_id);
-- INSERT is reserved for the edge function via service-role.