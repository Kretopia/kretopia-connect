
ALTER TABLE public.agent_proposals ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.agent_proposals
  ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'desk';

CREATE INDEX IF NOT EXISTS idx_agent_proposals_owner_surface_status
  ON public.agent_proposals(owner_user_id, surface, status, created_at DESC);

ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'gig_match';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'rate_optimize';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'frequent_collaborator';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'passport_polish';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'home_focus';
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'pay_cashflow';
