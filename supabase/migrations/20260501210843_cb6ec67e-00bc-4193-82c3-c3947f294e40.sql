INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler, enabled)
VALUES (
  'spin_up_project',
  'project_manager',
  'Create a new ThriveDesk project, invite a chosen collaborator, and queue a kickoff message — bundled into one approval.',
  'requires_approval',
  '{
    "type": "object",
    "properties": {
      "project_title": { "type": "string", "description": "Working title for the project" },
      "brief": { "type": "string", "description": "Short brief describing the work" },
      "creator_user_id": { "type": "string", "description": "User id of the collaborator to invite" },
      "creator_name": { "type": "string", "description": "Display name of the collaborator" },
      "creator_avatar_url": { "type": "string", "description": "Avatar URL for richer preview" },
      "kickoff_message": { "type": "string", "description": "Opening DM to send to the collaborator" }
    },
    "required": ["project_title", "creator_user_id", "kickoff_message"],
    "additionalProperties": true
  }'::jsonb,
  'inline_bundle',
  true
)
ON CONFLICT (tool_name) DO UPDATE
SET description = EXCLUDED.description,
    args_schema = EXCLUDED.args_schema,
    handler = EXCLUDED.handler,
    risk_level = EXCLUDED.risk_level,
    enabled = true;