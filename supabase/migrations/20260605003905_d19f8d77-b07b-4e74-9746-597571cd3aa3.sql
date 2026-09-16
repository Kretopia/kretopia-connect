
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, handler, args_schema)
VALUES
  (
    'negotiate_rate',
    'client_followup',
    'Draft a counter-offer reply when a client proposes a rate below your usual. Returns a draft message for the user to review before sending. Use when the user pastes an offer and asks how to respond.',
    'requires_approval',
    'thrive-creative-tools',
    '{"type":"object","properties":{"offer_amount":{"type":"number","description":"Amount the client offered."},"your_rate":{"type":"number","description":"Your usual rate for this work."},"currency":{"type":"string","default":"USD"},"offer_context":{"type":"string","description":"What the offer covers (scope, deliverables, timeline)."},"tone":{"type":"string","enum":["firm-warm","direct","collaborative"],"default":"firm-warm"}},"required":["offer_amount","your_rate"]}'::jsonb
  ),
  (
    'chase_followups',
    'client_followup',
    'Find outreach emails and invoices sent 7+ days ago with no reply, and draft polite chase messages for each. Returns a list of drafts the user can review before sending.',
    'safe_auto',
    'thrive-creative-tools',
    '{"type":"object","properties":{"days":{"type":"integer","minimum":3,"maximum":60,"default":7,"description":"How many days of silence counts as stale."}}}'::jsonb
  ),
  (
    'recycle_pitch',
    'talent',
    'Adapt the user''s best past pitches (ones that got replies or closed deals) for a new prospect. Preserves the user''s voice and structure, swaps the specifics. Returns subject + body draft.',
    'requires_approval',
    'thrive-creative-tools',
    '{"type":"object","properties":{"new_prospect_name":{"type":"string"},"new_prospect_context":{"type":"string","description":"What the prospect does, why now."},"project_type":{"type":"string","description":"What you''re pitching for (e.g. brand campaign, music video, photo shoot)."}},"required":["new_prospect_name"]}'::jsonb
  )
ON CONFLICT (tool_name) DO UPDATE
SET description = EXCLUDED.description,
    handler = EXCLUDED.handler,
    args_schema = EXCLUDED.args_schema,
    risk_level = EXCLUDED.risk_level,
    agent_kind = EXCLUDED.agent_kind,
    enabled = true;
