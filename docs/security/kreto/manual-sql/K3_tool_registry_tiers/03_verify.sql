-- LOT K3 -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. Every row should say PASS.
--
-- What it proves: no registry row is weaker than its policy floor, every change is recorded with its previous tier, and nothing was
-- lowered. What it does not prove: how a running orchestrator treats a tool. The proof is to ask Kreto, as a member, to do one raised tool
-- (for example "assign this task to <collaborator>"): it must come back as an approval card instead of running.

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
  SELECT r.tool_name, r.risk_level AS stored, coalesce(f.tier, 'requires_approval')::public.orch_risk_level AS floor
  FROM public.orch_tool_registry r LEFT JOIN floor f ON f.tool_name = r.tool_name
), checks(name, ok) AS (
  SELECT 'no registry row is below its policy floor', NOT EXISTS (SELECT 1 FROM plan WHERE stored < floor)
  UNION ALL SELECT 'the three locked tools are locked where they exist', NOT EXISTS (SELECT 1 FROM public.orch_tool_registry WHERE tool_name IN ('delete_project', 'charge_card', 'refresh_profile') AND risk_level <> 'locked')
  UNION ALL SELECT 'every raised row has its previous tier recorded',
    CASE WHEN to_regclass('public.kreto_migration_backup') IS NULL THEN false
         ELSE query_to_xml('SELECT 1 FROM public.kreto_migration_backup WHERE lot = ''K3'' AND kind = ''applied''', false, false, '')::text LIKE '%<row>%' END
  UNION ALL SELECT 'no recorded row was lowered',
    CASE WHEN to_regclass('public.kreto_migration_backup') IS NULL THEN false
         ELSE query_to_xml('SELECT 1 FROM public.kreto_migration_backup b JOIN public.orch_tool_registry r ON r.tool_name = b.object
                            WHERE b.lot = ''K3'' AND b.kind = ''tier'' AND r.risk_level < (b.detail ->> ''raised_to'')::public.orch_risk_level',
                           false, false, '')::text NOT LIKE '%<row>%' END
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM checks ORDER BY ok, name;
