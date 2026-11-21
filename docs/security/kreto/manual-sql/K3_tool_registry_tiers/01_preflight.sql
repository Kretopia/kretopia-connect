-- LOT K3 -- stored tool approvals match Kreto's tool policy -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- The code already acts on the STRICTER of a tool's registry row and its policy floor (supabase/functions/_shared/kretoToolPolicy.ts), so
-- the repository's orchestrator never runs a tool more freely than the policy allows. The registry rows themselves still say otherwise for
-- some tools, and the orchestrator deployed in production today reads ONLY the registry. 02_apply.sql raises those rows to the floor:
--   * a tool whose floor is "requires_approval" and whose row says safe_auto  -> requires_approval
--   * a tool whose floor is "locked" and whose row says anything else         -> locked
--   * a tool the policy does not know (the code needs approval for it)        -> requires_approval when its row says safe_auto
-- It never lowers a row, never touches args_schema, handler, enabled or description, and keeps the previous tier of every row it changes
-- in public.kreto_migration_backup for 04_rollback.sql.
--
-- Effect in production the moment it commits (no deploy needed): the tools it raises stop running on their own and come back as approval
-- cards; the three locked ones (delete_project, charge_card, refresh_profile) are no longer offered or run by the agent. People can still do
-- all of it themselves in the app.
--
-- The floor list below is generated from kretoToolPolicy.ts at commit f0e38a101 (65 tools) and is identical in 01, 02 and 03.

DO $pre$
BEGIN
  IF to_regclass('public.orch_tool_registry') IS NULL OR to_regtype('public.orch_risk_level') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: orch_tool_registry or orch_risk_level is missing. Is this kretopia-app?';
  END IF;
  IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = 'public.orch_risk_level'::regtype)
     IS DISTINCT FROM ARRAY['safe_auto', 'requires_approval', 'locked'] THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: orch_risk_level is not (safe_auto < requires_approval < locked); this lot compares tiers by that order.';
  END IF;
END
$pre$;

WITH floor(tool_name, tier) AS (VALUES
    ('ask_clarification', 'safe_auto'), ('find_user', 'safe_auto'), ('get_project_summary', 'safe_auto'), ('list_my_projects', 'safe_auto'),
    ('rank_creators', 'safe_auto'), ('recall_memory', 'safe_auto'), ('score_applicants', 'safe_auto'), ('search_creators', 'safe_auto'),
    ('summarize_opportunities', 'safe_auto'), ('triage_message', 'safe_auto'), ('weekly_money_summary', 'safe_auto'), ('chase_followups', 'safe_auto'),
    ('draft_credit', 'safe_auto'), ('draft_gig_application', 'safe_auto'), ('draft_milestone_invoice', 'safe_auto'), ('draft_outreach', 'safe_auto'),
    ('draft_outreach_email', 'safe_auto'), ('generate_event_cover', 'safe_auto'), ('negotiate_rate', 'safe_auto'), ('recycle_pitch', 'safe_auto'),
    ('suggest_missing_credits', 'safe_auto'), ('analyze_profile_url', 'safe_auto'), ('add_credit', 'safe_auto'), ('create_task', 'safe_auto'),
    ('mark_lead', 'safe_auto'), ('mark_task_done', 'safe_auto'), ('remember', 'safe_auto'), ('scan_receipt', 'safe_auto'),
    ('schedule_reminder', 'safe_auto'), ('archive_project', 'requires_approval'), ('assign_task', 'requires_approval'), ('create_event', 'requires_approval'),
    ('create_project', 'requires_approval'), ('generate_milestones', 'requires_approval'), ('match_event_guests', 'requires_approval'), ('rsvp_to_event', 'requires_approval'),
    ('spin_up_project', 'requires_approval'), ('enrich_profile', 'requires_approval'), ('find_sponsors', 'requires_approval'), ('research_web', 'requires_approval'),
    ('search_scouted_gigs', 'requires_approval'), ('refresh_profile', 'locked'), ('apply_to_gig', 'requires_approval'), ('request_vouch', 'requires_approval'),
    ('send_chase_email', 'requires_approval'), ('send_dm', 'requires_approval'), ('send_event_invite', 'requires_approval'), ('send_message', 'requires_approval'),
    ('send_message_to_collaborator', 'requires_approval'), ('send_outreach_email', 'requires_approval'), ('send_reminder', 'requires_approval'), ('send_triage_reply', 'requires_approval'),
    ('start_video_call', 'requires_approval'), ('create_gig', 'requires_approval'), ('publish_credit', 'requires_approval'), ('refresh_epk', 'requires_approval'),
    ('vouch_credit', 'requires_approval'), ('draft_invoice', 'requires_approval'), ('draft_quote', 'requires_approval'), ('send_payment_link', 'requires_approval'),
    ('charge_card', 'locked'), ('add_collaborator', 'requires_approval'), ('remove_collaborator', 'requires_approval'), ('forget_memory', 'requires_approval'),
    ('delete_project', 'locked')
), plan AS (
  SELECT r.tool_name, r.risk_level AS stored, coalesce(f.tier, 'requires_approval')::public.orch_risk_level AS floor, f.tool_name IS NULL AS unknown_to_policy, r.enabled
  FROM public.orch_tool_registry r LEFT JOIN floor f ON f.tool_name = r.tool_name
)
SELECT 'will_raise' AS finding, tool_name AS name, stored::text || ' -> ' || floor::text AS detail,
       CASE WHEN unknown_to_policy THEN 'not in the policy: the code already asks for it' ELSE 'policy floor' END
       || CASE WHEN enabled THEN '' ELSE ' (row disabled)' END AS note
FROM plan WHERE floor > stored
UNION ALL
SELECT 'already_at_or_above_floor', count(*)::text, NULL, NULL FROM plan WHERE floor <= stored
UNION ALL
SELECT 'stricter_than_policy_kept', tool_name, stored::text, 'the row is stricter than the floor; left as it is' FROM plan WHERE stored > floor AND NOT unknown_to_policy
UNION ALL
SELECT 'policy_tool_missing_from_registry', f.tool_name, f.tier, 'nothing to change' FROM floor f
WHERE NOT EXISTS (SELECT 1 FROM public.orch_tool_registry r WHERE r.tool_name = f.tool_name)
ORDER BY 1, 2;
