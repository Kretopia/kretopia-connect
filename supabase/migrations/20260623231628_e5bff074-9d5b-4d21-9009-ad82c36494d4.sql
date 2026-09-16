
-- Wave 1: Daily Briefing table + extended proposal kinds
CREATE TABLE IF NOT EXISTS public.ep_daily_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  brief_date date NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary text,
  task_count int NOT NULL DEFAULT 0,
  risk_count int NOT NULL DEFAULT 0,
  followup_count int NOT NULL DEFAULT 0,
  generated_by text NOT NULL DEFAULT 'rule',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, brief_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ep_daily_briefings TO authenticated;
GRANT ALL ON public.ep_daily_briefings TO service_role;

ALTER TABLE public.ep_daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own briefings"
  ON public.ep_daily_briefings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own briefings"
  ON public.ep_daily_briefings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ep_briefings_user_date
  ON public.ep_daily_briefings (user_id, brief_date DESC);

-- Extend proposal kinds for Wave 1 proactive rules
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'sponsor_followup_due';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'contract_unsigned';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'client_silence';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'deliverable_overdue';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'budget_incomplete';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'team_role_missing';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'daily_briefing_action';
