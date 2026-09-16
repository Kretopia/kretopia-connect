
INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler, enabled)
VALUES
  (
    'find_user',
    'project_manager',
    'Look up a person by spoken or typed name. Returns up to 5 candidate profiles, preferring the caller''s connections. Use before add_collaborator when you only have a name.',
    'safe_auto',
    '{"type":"object","properties":{"name_query":{"type":"string","description":"Name fragment, e.g. ''Rene Auguste'' or ''rene''."}},"required":["name_query"],"additionalProperties":false}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'list_my_projects',
    'project_manager',
    'List the caller''s active projects (owned + accepted collaborator). Use to disambiguate vague references like "the content project".',
    'safe_auto',
    '{"type":"object","properties":{},"additionalProperties":false}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'add_collaborator',
    'project_manager',
    'Add a user to a project (Auto-Accept). Posts a system message in project chat and notifies the invitee. Owner-only.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":"string","description":"UUID of the target project."},"user_id_to_add":{"type":"string","description":"UUID of the person to add (resolve via find_user first)."},"role":{"type":"string","enum":["member","creative","client","collaborator"],"description":"Role on the project; defaults to member."}},"required":["project_id","user_id_to_add"],"additionalProperties":false}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'remove_collaborator',
    'project_manager',
    'Remove a user from a project. Owner-only.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":"string"},"user_id_to_remove":{"type":"string"}},"required":["project_id","user_id_to_remove"],"additionalProperties":false}'::jsonb,
    'copilot-collaborator-tools',
    true
  )
ON CONFLICT (tool_name) DO UPDATE
SET description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    args_schema = EXCLUDED.args_schema,
    handler = EXCLUDED.handler,
    agent_kind = EXCLUDED.agent_kind,
    enabled = true,
    updated_at = now();
