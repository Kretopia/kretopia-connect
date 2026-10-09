-- Read-only verification for the 2026-10-09 security migrations.
-- Run in the Lovable Cloud SQL editor after applying; every row must read ok = true.

-- A. Server-only functions are no longer reachable by anon / signed-in users.
SELECT 'A server-only not callable by anon/authenticated' AS check_name,
       p.proname AS item,
       NOT (has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE')) AS ok
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
  AND p.proname = ANY (ARRAY[
    'enqueue_email','read_email_batch','delete_email','move_to_dlq','email_queue_dispatch',
    'merge_user_data','match_copilot_memories','touch_copilot_memory',
    'list_share_link_files','log_share_link_view','resolve_project_share_link',
    'consume_stage_application','increment_promo_use','increment_template_usage',
    'find_duplicate_account_candidates','create_multi_use_code','validate_invite_code',
    'claim_guest_rsvps','recompute_all_storage_usage','recompute_verification_tier','record_referral',
    'send_opportunity_alerts','thrivefund_auto_finalize_due','can_join_event_online',
    'check_storage_available','pending_inbox_triage_count','get_guest_brief'])
UNION ALL
-- B. The originals behind the guard wrappers are server-only too.
SELECT 'B *_impl not callable by anon/authenticated', p.proname,
       NOT (has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE '%\_impl' ESCAPE '\'
  AND p.proname = ANY (ARRAY[
    'get_network_stats_impl','get_network_health_impl','get_network_industry_breakdown_impl',
    'get_profiles_by_degree_impl','get_connection_path_impl','claim_profile_impl',
    'find_matching_unclaimed_profiles_impl','create_unclaimed_profile_impl','use_invite_code_impl',
    'generate_invite_codes_impl','auto_join_circles_for_role_impl','award_founding_member_badge_impl',
    'seed_new_user_experience_impl','use_partner_code_impl'])
UNION ALL
-- C. Guard wrappers: signed-in + server only (anon only for use_invite_code, sign-up flow).
SELECT 'C wrapper not callable by anon', p.proname,
       CASE WHEN p.proname = 'use_invite_code' AND pg_get_function_identity_arguments(p.oid) LIKE '%uuid%'
            THEN has_function_privilege('anon', p.oid, 'EXECUTE')
            ELSE NOT has_function_privilege('anon', p.oid, 'EXECUTE') END
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = ANY (ARRAY[
    'get_network_stats','get_network_health','get_network_industry_breakdown','get_profiles_by_degree',
    'get_connection_path','claim_profile','find_matching_unclaimed_profiles','create_unclaimed_profile',
    'generate_invite_codes','auto_join_circles_for_role','award_founding_member_badge',
    'seed_new_user_experience','use_partner_code','create_bidirectional_connection','create_notification'])
UNION ALL
-- D. The world-writable policies are gone.
SELECT 'D open policy removed', policyname || ' on ' || schemaname || '.' || tablename, false
FROM pg_policies
WHERE (schemaname, tablename, policyname) IN (
   ('public','share_link_approvals','Anyone can submit approval via valid link'),
   ('public','share_link_views','Anyone can log a view'),
   ('storage','objects','Service role can manage opportunity images'),
   ('storage','objects','Service role can write deal memo PDFs'))
UNION ALL
-- E. Studio: a pending invitation is not access (needs migration 0200).
SELECT 'E user_has_project_access ignores pending', 'user_has_project_access',
       pg_get_functiondef('public.user_has_project_access(uuid,uuid)'::regprocedure) !~* 'pending'
UNION ALL
SELECT 'E collaborator self-update guard installed', 'trg_guard_project_collaborator_self_update',
       EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_guard_project_collaborator_self_update' AND NOT tgisinternal)
UNION ALL
-- F. Event claim by token (needs migration 0300; policies removed by 0400).
SELECT 'F claim RPCs exist', 'get_scouted_event_by_token / claim_scouted_event',
       to_regprocedure('public.get_scouted_event_by_token(text)') IS NOT NULL
       AND to_regprocedure('public.claim_scouted_event(text)') IS NOT NULL
ORDER BY 1, 2;

-- G. Anything else callable by anon that is SECURITY DEFINER with no identity check
--    (re-run after each release; the list should only contain deliberate public endpoints:
--    token lookups, guest flows, RLS helpers, public stats).
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  AND p.prorettype::regtype::text <> 'trigger'
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
  AND pg_get_functiondef(p.oid) !~* 'auth\.uid\(\)'
ORDER BY 1;
