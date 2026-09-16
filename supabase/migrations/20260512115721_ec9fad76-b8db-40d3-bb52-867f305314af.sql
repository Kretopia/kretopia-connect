INSERT INTO public.orch_tool_registry (tool_name, agent_kind, handler, risk_level, description, args_schema)
VALUES
  (
    'archive_project',
    'project_manager',
    'copilot-collaborator-tools',
    'requires_approval',
    'Archive (soft-hide) a project. Reversible. Owner-only. Call list_my_projects first to resolve the exact project_id.',
    '{"type":"object","required":["project_id"],"properties":{"project_id":{"type":"string"}},"additionalProperties":true}'::jsonb
  ),
  (
    'delete_project',
    'project_manager',
    'copilot-collaborator-tools',
    'requires_approval',
    'Permanently delete a project and its tasks/files/chat. Destructive and irreversible. Owner-only. Prefer archive_project unless the user explicitly says delete. Call list_my_projects first to resolve the exact project_id.',
    '{"type":"object","required":["project_id"],"properties":{"project_id":{"type":"string"}},"additionalProperties":true}'::jsonb
  )
ON CONFLICT (tool_name) DO UPDATE SET
  agent_kind = EXCLUDED.agent_kind,
  handler = EXCLUDED.handler,
  risk_level = EXCLUDED.risk_level,
  description = EXCLUDED.description,
  args_schema = EXCLUDED.args_schema;