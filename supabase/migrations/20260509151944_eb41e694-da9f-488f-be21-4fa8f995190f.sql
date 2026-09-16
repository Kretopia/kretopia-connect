-- Phase 1.2: Auto-Outreach Agent — outreach_drafts table + orch tools

CREATE TABLE IF NOT EXISTS public.outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.sponsor_leads(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  recipient_name text,
  recipient_email text,
  brand_name text,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  send_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_drafts_status_check CHECK (status IN ('draft','approved','sending','sent','dismissed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_user_status
  ON public.outreach_drafts(user_id, status, created_at DESC);

ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own outreach drafts select" ON public.outreach_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own outreach drafts insert" ON public.outreach_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own outreach drafts update" ON public.outreach_drafts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own outreach drafts delete" ON public.outreach_drafts
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_outreach_drafts_updated
  BEFORE UPDATE ON public.outreach_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime so Approvals tray updates instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_drafts;

-- Register two orch tools (idempotent)
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, risk_level, handler, description, args_schema)
VALUES
  ('draft_outreach_email', 'talent', 'safe_auto', 'draft-outreach-email',
   'Draft a personalized cold-outreach email for a sponsor lead and save it to outreach_drafts (status=draft) for owner review.',
   '{"type":"object","properties":{"lead_id":{"type":"string","description":"sponsor_leads.id (preferred when drafting from a sponsor lead)"},"brand_name":{"type":"string","description":"Brand name when no lead_id"},"angle":{"type":"string","description":"Optional positioning angle / hook"}},"required":[]}'::jsonb),
  ('send_outreach_email', 'talent', 'requires_approval', 'send-outreach-draft',
   'Send a previously-drafted outreach email via the user''s connected Gmail. Marks the draft as sent and the sponsor_lead as contacted.',
   '{"type":"object","properties":{"draft_id":{"type":"string"}},"required":["draft_id"]}'::jsonb)
ON CONFLICT (tool_name) DO UPDATE
  SET handler = EXCLUDED.handler,
      risk_level = EXCLUDED.risk_level,
      description = EXCLUDED.description,
      args_schema = EXCLUDED.args_schema,
      enabled = true;