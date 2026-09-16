ALTER TABLE public.sponsor_leads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS match_evidence jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sponsor_leads_project_status
  ON public.sponsor_leads(project_id, status, fit_score DESC);

INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler, enabled)
VALUES (
  'find_sponsors',
  'opportunity',
  'Search and scrape the web for real brand sponsor leads matched to the user and, when provided, a specific project/event. Returns brand names, websites, contact names, emails, phones, addresses, source URLs, match reasons, and pitch drafts. Persists to sponsor_leads and mirrors event/project leads into the Studio sponsor pipeline.',
  'safe_auto',
  '{
    "type": "object",
    "properties": {
      "niche": { "type": "string", "description": "Sponsor target, niche, event, or project name (e.g. Bali Carnival, Caribbean fashion, soca event)." },
      "project_id": { "type": "string", "description": "Exact project UUID when the sponsor request is for a named existing Studio/project." },
      "project_title": { "type": "string", "description": "Project/event title when known." },
      "count": { "type": "integer", "minimum": 3, "maximum": 8, "description": "How many sponsor leads to return (3-8). Default 5." }
    },
    "required": []
  }'::jsonb,
  'sponsor-radar',
  true
)
ON CONFLICT (tool_name) DO UPDATE SET
  agent_kind = EXCLUDED.agent_kind,
  description = EXCLUDED.description,
  risk_level = EXCLUDED.risk_level,
  args_schema = EXCLUDED.args_schema,
  handler = EXCLUDED.handler,
  enabled = true,
  updated_at = now();