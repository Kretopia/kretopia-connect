
-- Inbox Triage classifications
CREATE TYPE public.inbox_triage_kind AS ENUM (
  'lead', 'gig_inquiry', 'collab', 'fan', 'spam', 'admin', 'other'
);

CREATE TYPE public.inbox_triage_status AS ENUM (
  'pending', 'approved', 'sent', 'dismissed', 'failed'
);

CREATE TABLE public.inbox_triage_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  sender_user_id uuid NOT NULL,
  kind public.inbox_triage_kind NOT NULL,
  confidence numeric(4,3) NOT NULL DEFAULT 0,
  summary text,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  draft_reply text,
  draft_subject text,
  status public.inbox_triage_status NOT NULL DEFAULT 'pending',
  dismissed_reason text,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id)
);

CREATE INDEX idx_inbox_triage_owner_status
  ON public.inbox_triage_classifications (owner_user_id, status, created_at DESC);

CREATE INDEX idx_inbox_triage_kind
  ON public.inbox_triage_classifications (kind) WHERE status = 'pending';

ALTER TABLE public.inbox_triage_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read own triage"
  ON public.inbox_triage_classifications FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "owners update own triage"
  ON public.inbox_triage_classifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Inserts only via service role (edge fn) — no insert policy

CREATE TRIGGER trg_inbox_triage_updated_at
  BEFORE UPDATE ON public.inbox_triage_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Counter helper for Home badge
CREATE OR REPLACE FUNCTION public.pending_inbox_triage_count(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.inbox_triage_classifications
  WHERE owner_user_id = _user_id
    AND status = 'pending'
    AND kind IN ('lead', 'gig_inquiry', 'collab');
$$;

GRANT EXECUTE ON FUNCTION public.pending_inbox_triage_count(uuid) TO authenticated;

-- Register tools in orch_tool_registry (idempotent)
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler)
VALUES
  ('triage_message', 'orchestrator', 'Classify an inbound message (lead/gig/collab/fan/spam/admin) and draft a reply when actionable.', 'safe_auto',
   '{"type":"object","properties":{"message_id":{"type":"string"}},"required":["message_id"]}'::jsonb,
   'inbox-triage-agent'),
  ('send_triage_reply', 'orchestrator', 'Send the drafted reply for a triaged message via DM.', 'requires_approval',
   '{"type":"object","properties":{"triage_id":{"type":"string"},"reply":{"type":"string"}},"required":["triage_id","reply"]}'::jsonb,
   'inbox-triage-agent'),
  ('mark_lead', 'client_followup', 'Mark a triaged inbound message as a sales lead and add the sender to the pipeline.', 'safe_auto',
   '{"type":"object","properties":{"triage_id":{"type":"string"}},"required":["triage_id"]}'::jsonb,
   'inbox-triage-agent')
ON CONFLICT (tool_name) DO NOTHING;
