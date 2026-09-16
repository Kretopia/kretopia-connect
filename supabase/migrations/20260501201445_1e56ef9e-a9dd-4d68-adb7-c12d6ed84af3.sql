
-- ============ ENUMS (only create if not exists) ============
DO $$ BEGIN
  CREATE TYPE public.orch_risk_level AS ENUM ('safe_auto', 'requires_approval', 'locked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.orch_run_status AS ENUM ('pending', 'running', 'awaiting_approval', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.orch_action_status AS ENUM ('proposed', 'approved', 'rejected', 'executed', 'failed', 'auto_executed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.orch_approval_decision AS ENUM ('approved', 'rejected', 'edited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.orch_agent_kind AS ENUM (
    'orchestrator','profile','talent','gig','project_manager','client_followup',
    'payment','credit','opportunity','event','site_epk','money_admin','community'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS public.orch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_kind public.orch_agent_kind NOT NULL DEFAULT 'orchestrator',
  intent_text TEXT,
  intent_classified TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  status public.orch_run_status NOT NULL DEFAULT 'pending',
  summary TEXT,
  error TEXT,
  tokens_used INT DEFAULT 0,
  latency_ms INT,
  parent_run_id UUID REFERENCES public.orch_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orch_runs_user ON public.orch_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orch_runs_status ON public.orch_runs(status) WHERE status IN ('pending','running','awaiting_approval');

CREATE TABLE IF NOT EXISTS public.orch_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.orch_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_level public.orch_risk_level NOT NULL DEFAULT 'requires_approval',
  status public.orch_action_status NOT NULL DEFAULT 'proposed',
  result JSONB,
  error TEXT,
  preview_title TEXT,
  preview_body TEXT,
  created_record_ids JSONB DEFAULT '{}'::jsonb,
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orch_actions_run ON public.orch_actions(run_id);
CREATE INDEX IF NOT EXISTS idx_orch_actions_user_pending ON public.orch_actions(user_id, status) WHERE status = 'proposed';

CREATE TABLE IF NOT EXISTS public.orch_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.orch_actions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  decision public.orch_approval_decision NOT NULL,
  edited_args JSONB,
  note TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orch_approvals_action ON public.orch_approvals(action_id);

CREATE TABLE IF NOT EXISTS public.orch_tool_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL UNIQUE,
  agent_kind public.orch_agent_kind NOT NULL,
  description TEXT NOT NULL,
  risk_level public.orch_risk_level NOT NULL,
  args_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  handler TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orch_tools_kind ON public.orch_tool_registry(agent_kind) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS public.orch_settings (
  user_id UUID PRIMARY KEY,
  agents_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_run_safe BOOLEAN NOT NULL DEFAULT true,
  agent_mode_projects BOOLEAN NOT NULL DEFAULT false,
  agent_mode_talent BOOLEAN NOT NULL DEFAULT false,
  agent_mode_payments BOOLEAN NOT NULL DEFAULT false,
  agent_mode_credits BOOLEAN NOT NULL DEFAULT false,
  daily_action_limit INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.update_orch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_orch_runs_updated ON public.orch_runs;
CREATE TRIGGER trg_orch_runs_updated BEFORE UPDATE ON public.orch_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_orch_updated_at();

DROP TRIGGER IF EXISTS trg_orch_tools_updated ON public.orch_tool_registry;
CREATE TRIGGER trg_orch_tools_updated BEFORE UPDATE ON public.orch_tool_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_orch_updated_at();

DROP TRIGGER IF EXISTS trg_orch_settings_updated ON public.orch_settings;
CREATE TRIGGER trg_orch_settings_updated BEFORE UPDATE ON public.orch_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_orch_updated_at();

-- ============ RLS ============
ALTER TABLE public.orch_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orch_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orch_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orch_tool_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orch runs" ON public.orch_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orch runs" ON public.orch_runs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own orch actions" ON public.orch_actions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own orch approvals" ON public.orch_approvals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orch approvals" ON public.orch_approvals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated read orch tool registry" ON public.orch_tool_registry FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users view own orch settings" ON public.orch_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own orch settings" ON public.orch_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own orch settings" ON public.orch_settings FOR UPDATE USING (auth.uid() = user_id);

-- ============ SEED TOOL REGISTRY ============
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, handler, args_schema) VALUES
  ('refresh_profile', 'profile', 'Re-scan public sources and suggest profile updates', 'safe_auto', 'auto-discover-creatives', '{"type":"object","properties":{}}'::jsonb),
  ('suggest_missing_credits', 'profile', 'Suggest credits user might be missing', 'safe_auto', 'enrich-credits', '{"type":"object","properties":{}}'::jsonb),
  ('request_vouch', 'profile', 'Request a vouch from a collaborator', 'requires_approval', 'send-credit-invite', '{"type":"object","properties":{"collaborator_id":{"type":"string"},"credit_id":{"type":"string"},"message":{"type":"string"}},"required":["collaborator_id"]}'::jsonb),
  ('search_creators', 'talent', 'Search ThriveIN profiles by role/location/budget/availability', 'safe_auto', 'discover-creators', '{"type":"object","properties":{"role":{"type":"string"},"location":{"type":"string"},"budget_max":{"type":"number"},"date":{"type":"string"}},"required":["role"]}'::jsonb),
  ('rank_creators', 'talent', 'Rank shortlist by trust/credits/availability', 'safe_auto', 'ai-talent-match', '{"type":"object","properties":{"creator_ids":{"type":"array","items":{"type":"string"}},"criteria":{"type":"string"}}}'::jsonb),
  ('draft_outreach', 'talent', 'Draft outreach message to a creator', 'safe_auto', 'generate-content', '{"type":"object","properties":{"creator_id":{"type":"string"},"context":{"type":"string"}},"required":["creator_id"]}'::jsonb),
  ('send_message', 'talent', 'Send a direct message to a user', 'requires_approval', 'send-user-email', '{"type":"object","properties":{"to_user_id":{"type":"string"},"body":{"type":"string"}},"required":["to_user_id","body"]}'::jsonb),
  ('create_gig', 'gig', 'Create a gig from natural language brief', 'requires_approval', 'enhance-gig', '{"type":"object","properties":{"brief":{"type":"string"},"budget":{"type":"number"},"deadline":{"type":"string"}},"required":["brief"]}'::jsonb),
  ('apply_to_gig', 'gig', 'Submit application to a gig on user behalf', 'requires_approval', 'send-outreach-email', '{"type":"object","properties":{"gig_id":{"type":"string"},"pitch":{"type":"string"}},"required":["gig_id"]}'::jsonb),
  ('score_applicants', 'gig', 'Score gig applicants for the employer', 'safe_auto', 'ai-talent-match', '{"type":"object","properties":{"gig_id":{"type":"string"}},"required":["gig_id"]}'::jsonb),
  ('create_project', 'project_manager', 'Create a new project', 'requires_approval', 'desk-agent', '{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"}},"required":["title"]}'::jsonb),
  ('create_task', 'project_manager', 'Create a task in a project', 'safe_auto', 'desk-agent', '{"type":"object","properties":{"project_id":{"type":"string"},"title":{"type":"string"},"due_date":{"type":"string"},"assignee_id":{"type":"string"}},"required":["project_id","title"]}'::jsonb),
  ('assign_task', 'project_manager', 'Assign a task to a collaborator', 'safe_auto', 'desk-agent', '{"type":"object","properties":{"task_id":{"type":"string"},"assignee_id":{"type":"string"}},"required":["task_id","assignee_id"]}'::jsonb),
  ('generate_milestones', 'project_manager', 'Break project brief into milestones', 'safe_auto', 'scope-guardian', '{"type":"object","properties":{"project_id":{"type":"string"}},"required":["project_id"]}'::jsonb),
  ('send_reminder', 'client_followup', 'Send polite reminder to client/collaborator', 'requires_approval', 'send-notification-email', '{"type":"object","properties":{"to_user_id":{"type":"string"},"context":{"type":"string"}},"required":["to_user_id"]}'::jsonb),
  ('draft_invoice', 'payment', 'Draft an invoice (never auto-sent)', 'safe_auto', 'desk-agent', '{"type":"object","properties":{"project_id":{"type":"string"},"amount":{"type":"number"},"description":{"type":"string"}},"required":["project_id","amount"]}'::jsonb),
  ('send_payment_link', 'payment', 'Send payment link for a draft invoice', 'requires_approval', 'send-get-paid-link', '{"type":"object","properties":{"invoice_id":{"type":"string"}},"required":["invoice_id"]}'::jsonb),
  ('charge_card', 'payment', 'Capture a charge on a saved card', 'locked', 'create-payment', '{"type":"object","properties":{}}'::jsonb),
  ('draft_credit', 'credit', 'Draft a verified credit after project completion', 'safe_auto', 'desk-agent', '{"type":"object","properties":{"project_id":{"type":"string"},"role":{"type":"string"}},"required":["project_id"]}'::jsonb),
  ('publish_credit', 'credit', 'Publish a credit to user profile', 'requires_approval', 'verify-credit', '{"type":"object","properties":{"credit_id":{"type":"string"}},"required":["credit_id"]}'::jsonb),
  ('summarize_opportunities', 'opportunity', 'Summarize matching gigs/events for digest', 'safe_auto', 'personalized-recommendations', '{"type":"object","properties":{}}'::jsonb),
  ('create_event', 'event', 'Create an event from a prompt', 'requires_approval', 'extract-event-details', '{"type":"object","properties":{"brief":{"type":"string"}},"required":["brief"]}'::jsonb),
  ('refresh_epk', 'site_epk', 'Regenerate EPK/site from latest profile', 'safe_auto', 'generate-site', '{"type":"object","properties":{}}'::jsonb),
  ('weekly_money_summary', 'money_admin', 'Generate weekly money summary', 'safe_auto', 'ai-finance', '{"type":"object","properties":{}}'::jsonb),
  ('ask_clarification', 'orchestrator', 'Ask the user for missing information', 'safe_auto', 'inline', '{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}'::jsonb)
ON CONFLICT (tool_name) DO NOTHING;
