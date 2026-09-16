
CREATE TYPE public.agent_proposal_kind AS ENUM (
  'draft_invoice',
  'schedule_followup',
  'next_milestone',
  'wrap_project',
  'collab_nudge',
  'other'
);

CREATE TYPE public.agent_proposal_status AS ENUM (
  'pending',
  'accepted',
  'dismissed',
  'expired'
);

CREATE TABLE public.agent_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  kind public.agent_proposal_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_intent JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.agent_proposal_status NOT NULL DEFAULT 'pending',
  source_signal JSONB DEFAULT '{}'::jsonb,
  dismissed_reason TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_proposals_project_status
  ON public.agent_proposals(project_id, status, created_at DESC);

CREATE INDEX idx_agent_proposals_owner_status
  ON public.agent_proposals(owner_user_id, status);

ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own proposals"
  ON public.agent_proposals FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "owners update own proposals"
  ON public.agent_proposals FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- No INSERT policy: only service_role (edge fn) inserts.

CREATE TRIGGER trg_agent_proposals_updated_at
  BEFORE UPDATE ON public.agent_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
