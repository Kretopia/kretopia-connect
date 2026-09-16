INSERT INTO public.orch_tool_registry (tool_name, agent_kind, description, risk_level, args_schema, handler, enabled)
VALUES
  (
    'create_task',
    'project_manager',
    'Create a new task on a project. Defaults to the current project when project_id is omitted.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"],"description":"Optional project id. Null means current project."},"title":{"type":"string","description":"Short task title."},"description":{"type":["string","null"]},"due_date":{"type":["string","null"],"description":"YYYY-MM-DD or null."},"assignee_user_id":{"type":["string","null"],"description":"Collaborator user id or null."},"priority":{"type":["string","null"],"enum":["low","medium","high",null]}},"required":["title"],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'mark_task_done',
    'project_manager',
    'Mark an existing project task as done by task id or title fragment.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"task_id":{"type":["string","null"]},"title_match":{"type":["string","null"]}},"required":[],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'send_message_to_collaborator',
    'project_manager',
    'Post a message into project chat, optionally mentioning a collaborator.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"message":{"type":"string"},"mention_user_id":{"type":["string","null"]}},"required":["message"],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'get_project_summary',
    'project_manager',
    'Return a concise status summary for a project.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]}},"required":[],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'schedule_reminder',
    'project_manager',
    'Create a reminder task on a project.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"what":{"type":"string"},"when_iso":{"type":"string","description":"YYYY-MM-DD"}},"required":["what","when_iso"],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'draft_invoice',
    'payment',
    'Create a draft invoice or quote for a project. Never sends it automatically.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":["string","null"],"description":"Optional project id. Null means current project."},"amount":{"type":"number"},"currency":{"type":["string","null"],"description":"USD, TTD, etc."},"notes":{"type":["string","null"],"description":"Line-item or scope description."},"description":{"type":["string","null"],"description":"Fallback for notes."},"due_in_days":{"type":["number","null"]}},"required":["amount"],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'start_video_call',
    'project_manager',
    'Start a project video room and post the join link in chat.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]}},"required":[],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'add_credit',
    'credit',
    'Add a ThriveCredit to the user profile from the current project.',
    'safe_auto',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"role":{"type":"string"},"year":{"type":["number","null"]},"description":{"type":["string","null"]}},"required":["role"],"additionalProperties":true}'::jsonb,
    'desk-agent',
    true
  ),
  (
    'find_user',
    'project_manager',
    'Look up a person by spoken or typed name. Returns candidates from connections and public profiles. Use before collaborator actions when only a name is given.',
    'safe_auto',
    '{"type":"object","properties":{"name_query":{"type":"string","description":"Name fragment, e.g. Rene Auguste."}},"required":["name_query"],"additionalProperties":true}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'list_my_projects',
    'project_manager',
    'List the caller active projects. Use to resolve a named project.',
    'safe_auto',
    '{"type":"object","properties":{},"required":[],"additionalProperties":true}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'add_collaborator',
    'project_manager',
    'Add a user to a project after find_user resolves the person. Owner-only.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"target_project_id":{"type":["string","null"]},"user_id_to_add":{"type":"string"},"role":{"type":["string","null"],"enum":["member","creative","client","collaborator",null]}},"required":["user_id_to_add"],"additionalProperties":true}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'remove_collaborator',
    'project_manager',
    'Remove a user from a project after find_user resolves the person. Owner-only.',
    'requires_approval',
    '{"type":"object","properties":{"project_id":{"type":["string","null"]},"target_project_id":{"type":["string","null"]},"user_id_to_remove":{"type":"string"}},"required":["user_id_to_remove"],"additionalProperties":true}'::jsonb,
    'copilot-collaborator-tools',
    true
  ),
  (
    'ask_clarification',
    'orchestrator',
    'Ask the user one short follow-up question when required details are missing.',
    'safe_auto',
    '{"type":"object","properties":{"question":{"type":"string"}},"required":["question"],"additionalProperties":true}'::jsonb,
    'inline',
    true
  )
ON CONFLICT (tool_name) DO UPDATE
SET agent_kind = EXCLUDED.agent_kind,
    description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    args_schema = EXCLUDED.args_schema,
    handler = EXCLUDED.handler,
    enabled = EXCLUDED.enabled,
    updated_at = now();