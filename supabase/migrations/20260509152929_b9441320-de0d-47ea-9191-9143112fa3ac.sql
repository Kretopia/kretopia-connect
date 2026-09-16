-- Add chase_invoice to agent_proposal_kind enum
ALTER TYPE public.agent_proposal_kind ADD VALUE IF NOT EXISTS 'chase_invoice';

-- Register Phase 2 orchestrator tools (idempotent)
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler)
VALUES
  (
    'send_chase_email',
    'money_admin',
    'Send a polite payment-chase email for an overdue invoice. Requires owner approval.',
    'requires_approval',
    '{"type":"object","properties":{"invoice_id":{"type":"string"},"tone":{"type":"string","enum":["friendly","firm"],"default":"friendly"}},"required":["invoice_id"]}'::jsonb,
    'send-invoice-chase'
  ),
  (
    'draft_milestone_invoice',
    'money_admin',
    'Draft an invoice for a deliverable that just moved to approved. Inserts a draft invoice for owner review.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":"string"},"deliverable_id":{"type":"string"},"amount":{"type":"number"},"description":{"type":"string"}},"required":["project_id"]}'::jsonb,
    'desk-agent'
  )
ON CONFLICT (tool_name) DO UPDATE
  SET description = EXCLUDED.description,
      risk_level = EXCLUDED.risk_level,
      args_schema = EXCLUDED.args_schema,
      handler = EXCLUDED.handler,
      enabled = true;