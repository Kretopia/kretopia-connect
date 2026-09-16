
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler)
VALUES (
  'research_web',
  'opportunity',
  'Research the open web (Firecrawl + AI) for real venues, brands, vendors, agencies, studios, contacts, or any business matching the user''s description. Returns 10-40 structured leads with name, company, role, email, website, notes. Use for "find me venues in Canggu", "list co-working spaces in Bali", "who could I sponsor with", "find PR agencies in NYC", "scout vendors for X".',
  'safe_auto',
  '{
    "type":"object",
    "properties":{
      "query":{"type":"string","description":"What to search for (e.g. \"co-working spaces with meeting rooms\", \"sustainable fashion brands\")."},
      "industry":{"type":"string","description":"Optional industry/niche filter."},
      "location":{"type":"string","description":"Optional city/region filter (e.g. \"Canggu, Bali\")."}
    },
    "required":["query"]
  }'::jsonb,
  'scout-leads'
)
ON CONFLICT (tool_name) DO UPDATE SET
  description = EXCLUDED.description,
  args_schema = EXCLUDED.args_schema,
  handler     = EXCLUDED.handler,
  risk_level  = EXCLUDED.risk_level,
  agent_kind  = EXCLUDED.agent_kind;
