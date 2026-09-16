
-- Per-user scout preferences
CREATE TABLE public.scout_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sources TEXT[] NOT NULL DEFAULT ARRAY['web','linkedin','instagram','ats'],
  extra_keywords TEXT[],
  exclude_keywords TEXT[],
  remote_only BOOLEAN DEFAULT false,
  min_fit_score INT DEFAULT 60,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scout_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own scout prefs" ON public.scout_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scouted gigs (external)
CREATE TABLE public.scouted_gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                 -- 'web' | 'linkedin' | 'instagram' | 'ats' | 'gigboard'
  source_name TEXT,                     -- e.g. 'Mandy', 'Greenhouse', 'Backstage', 'Instagram'
  source_url TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  remote BOOLEAN DEFAULT false,
  description TEXT,
  compensation TEXT,
  deadline TIMESTAMPTZ,
  contact_email TEXT,
  apply_url TEXT,
  skills TEXT[],
  tags TEXT[],
  fit_score INT NOT NULL DEFAULT 0,     -- 0-100
  fit_reason TEXT,
  raw JSONB,
  posted_at TIMESTAMPTZ,
  scouted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  dedupe_key TEXT NOT NULL,
  UNIQUE (target_user_id, dedupe_key)
);
CREATE INDEX idx_scouted_gigs_user_score ON public.scouted_gigs(target_user_id, fit_score DESC, scouted_at DESC);
CREATE INDEX idx_scouted_gigs_expires ON public.scouted_gigs(expires_at);
ALTER TABLE public.scouted_gigs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own scouted gigs" ON public.scouted_gigs
  FOR SELECT USING (auth.uid() = target_user_id);

-- Per-user actions on scouted gigs
CREATE TABLE public.scouted_gig_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scouted_gig_id UUID NOT NULL REFERENCES public.scouted_gigs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                 -- 'saved' | 'applied' | 'dismissed' | 'opened'
  cover_letter TEXT,
  outcome TEXT,                         -- 'pending' | 'replied' | 'hired' | 'rejected' | 'no_response'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scouted_gig_id, action)
);
ALTER TABLE public.scouted_gig_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own gig actions" ON public.scouted_gig_actions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Scout run log (for monitoring)
CREATE TABLE public.scout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,                -- 'cron' | 'manual'
  sources TEXT[],
  found_count INT DEFAULT 0,
  inserted_count INT DEFAULT 0,
  duration_ms INT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
ALTER TABLE public.scout_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own scout runs" ON public.scout_runs
  FOR SELECT USING (auth.uid() = user_id);
