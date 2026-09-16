
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, handler, args_schema, enabled)
VALUES
('remember', 'memory'::orch_agent_kind, 'Save a long-term fact about the user (vendor, sponsor, contact, preference, follow-up, rate, client, note). Use when the user says "remember…", "for next time…", or shares a durable fact.', 'safe_auto', 'thrive-memory-tool',
 '{"type":"object","required":["label"],"properties":{"label":{"type":"string"},"body":{"type":"string"},"kind":{"type":"string","enum":["vendor","sponsor","contact","preference","follow_up","fact","client","rate","note"]},"importance":{"type":"integer","minimum":1,"maximum":5}}}'::jsonb,
 true),
('recall_memory', 'memory'::orch_agent_kind, 'Look up things Thrive previously remembered for this user. Filter by kind or fuzzy text query.', 'safe_auto', 'thrive-memory-tool',
 '{"type":"object","properties":{"query":{"type":"string"},"kind":{"type":"string"},"limit":{"type":"integer","default":8}}}'::jsonb,
 true),
('forget_memory', 'memory'::orch_agent_kind, 'Delete a previously stored memory by id (or by mem_key+kind).', 'requires_approval', 'thrive-memory-tool',
 '{"type":"object","properties":{"memory_id":{"type":"string"},"mem_key":{"type":"string"},"kind":{"type":"string"}}}'::jsonb,
 true)
ON CONFLICT (tool_name) DO UPDATE SET
  description = EXCLUDED.description,
  handler = EXCLUDED.handler,
  args_schema = EXCLUDED.args_schema,
  agent_kind = EXCLUDED.agent_kind,
  risk_level = EXCLUDED.risk_level,
  enabled = true;
