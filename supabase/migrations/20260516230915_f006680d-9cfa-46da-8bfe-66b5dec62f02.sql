INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler, enabled)
VALUES (
  'find_sponsors',
  'opportunity',
  'Generate a personalized list of brand sponsor leads matched to the user''s niche, role, region and bio. Returns brand_name, fit_score, reason, pitch_draft for each. Persists to sponsor_leads so the user can review them in the Intel hub and draft outreach.',
  'safe_auto',
  '{
    "type": "object",
    "properties": {
      "niche": { "type": "string", "description": "Optional niche/topic to bias toward (e.g. Bali Carnival, Caribbean fashion). Defaults to the user primary_role." },
      "count": { "type": "integer", "minimum": 3, "maximum": 8, "description": "How many sponsor leads to generate (3-8). Default 5." }
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