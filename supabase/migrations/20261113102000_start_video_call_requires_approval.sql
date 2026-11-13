-- orch_tool_registry: start_video_call waits for the person's approval.
--
-- READ BEFORE APPLYING. Not applied by anyone: this file is a reviewed proposal in a PR.
-- Apply it BEFORE deploying the desk-agent and agent-orchestrator changes of the same PR
-- (docs/security-compliance/p0-fixes-2026-11-13.md, section "Desk agent").
--
-- Why
--   start_video_call opens a call room and posts its join link in the project chat, for every member of the project.
--   It was 'safe_auto' (20260504203621), so agent-orchestrator ran it as soon as a model chose it. Its sibling
--   send_message_to_collaborator, which also posts in that chat, is already 'requires_approval'. desk-agent now queues
--   both for approval (supabase/functions/_shared/deskApproval.ts); with this row the orchestrator proposes it too,
--   instead of calling desk-agent with an unapproved request that desk-agent would turn into a second proposal.
--
-- What: one registry row, one column. No user data, no other tool.
-- Rollback:
--   UPDATE public.orch_tool_registry SET risk_level = 'safe_auto', updated_at = now() WHERE tool_name = 'start_video_call';

UPDATE public.orch_tool_registry
SET risk_level = 'requires_approval',
    updated_at = now()
WHERE tool_name = 'start_video_call'
  AND risk_level IS DISTINCT FROM 'requires_approval';
