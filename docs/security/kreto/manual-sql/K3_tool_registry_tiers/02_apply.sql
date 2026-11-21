-- LOT K3 -- stored tool approvals match Kreto's tool policy -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after
-- 01_preflight.sql listed the rows it will raise. One transaction. It raises risk_level on those rows of orch_tool_registry, never lowers
-- one, and records each previous tier in public.kreto_migration_backup.
--
-- Compatibility: both orchestrators read risk_level. The production one (registry only) starts asking for the raised tools and skips the
-- locked ones; the repository one already acted on the floor, so for it nothing changes. Proposals already waiting keep the tier they were
-- made with; production's executeAction re-reads the registry and refuses a tool that became locked ("Tool unavailable or changed").
-- Order: SQL only, nothing to deploy.

BEGIN;

DO $assert$
BEGIN
  IF to_regclass('public.orch_tool_registry') IS NULL OR to_regtype('public.orch_risk_level') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: orch_tool_registry or orch_risk_level is missing. Nothing was changed.';
  END IF;
  IF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = 'public.orch_risk_level'::regtype)
     IS DISTINCT FROM ARRAY['safe_auto', 'requires_approval', 'locked'] THEN
    RAISE EXCEPTION 'APPLY STOPPED: orch_risk_level is not (safe_auto < requires_approval < locked). Nothing was changed.';
  END IF;
  -- Nested on purpose: PL/pgSQL prepares a whole condition, so the backup table is only named once it is known to exist.
  IF to_regclass('public.kreto_migration_backup') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.kreto_migration_backup WHERE lot = 'K3') THEN
      RAISE EXCEPTION 'APPLY STOPPED: lot K3 is already applied (its backup rows exist). Nothing was changed.';
    END IF;
  END IF;
END
$assert$;

-- Shared by the Kreto lots (same definition as in K1): what an apply changed, so its rollback restores exactly that.
CREATE TABLE IF NOT EXISTS public.kreto_migration_backup (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot text NOT NULL,
  kind text NOT NULL,
  object text NOT NULL,
  detail jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kreto_migration_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.kreto_migration_backup FROM PUBLIC, anon, authenticated;

CREATE TEMP TABLE k3_plan ON COMMIT DROP AS
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
)
SELECT r.id, r.tool_name, r.risk_level AS stored, coalesce(f.tier, 'requires_approval')::public.orch_risk_level AS floor
FROM public.orch_tool_registry r LEFT JOIN floor f ON f.tool_name = r.tool_name;

INSERT INTO public.kreto_migration_backup (lot, kind, object, detail)
SELECT 'K3', 'tier', tool_name, jsonb_build_object('registry_id', id, 'risk_level', stored, 'raised_to', floor)
FROM k3_plan WHERE floor > stored;
INSERT INTO public.kreto_migration_backup (lot, kind, object, detail) VALUES ('K3', 'applied', 'K3', '{}'::jsonb);

UPDATE public.orch_tool_registry r
   SET risk_level = p.floor
  FROM k3_plan p
 WHERE p.id = r.id AND p.floor > r.risk_level;

DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM k3_plan p JOIN public.orch_tool_registry r ON r.id = p.id WHERE r.risk_level < p.floor) THEN
    RAISE EXCEPTION 'APPLY UNDONE: a registry row is still below its floor. Nothing was changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM k3_plan p JOIN public.orch_tool_registry r ON r.id = p.id WHERE r.risk_level < p.stored) THEN
    RAISE EXCEPTION 'APPLY UNDONE: a registry row was lowered. Nothing was changed.';
  END IF;
END
$check$;

COMMIT;

SELECT 'applied' AS result,
       (SELECT count(*) FROM public.kreto_migration_backup WHERE lot = 'K3' AND kind = 'tier') AS rows_raised,
       (SELECT string_agg(object || ' ' || (detail ->> 'risk_level') || '->' || (detail ->> 'raised_to'), ', ' ORDER BY object)
          FROM public.kreto_migration_backup WHERE lot = 'K3' AND kind = 'tier') AS changes,
       'now run 03_verify.sql' AS next_step;
