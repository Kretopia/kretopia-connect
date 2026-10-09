-- ============================================================================
-- Security lockdown of anonymous-callable SECURITY DEFINER functions
-- (audit 2026-10-09, Studio + Passport security brief).
--
-- WHY
--   Every function in `public` is executable by `anon` and `authenticated` by
--   default (default ACL), and the anon key ships in the app bundle, so a
--   visitor with no account can call any of them through
--   /rest/v1/rpc/<name>. ~100 SECURITY DEFINER functions ran with no identity
--   check and accept a caller-supplied user id. Verified read-only against
--   production on 2026-10-09 (has_function_privilege + anon-key probes):
--
--   * enqueue_email / read_email_batch / delete_email / move_to_dlq
--       -> send mail from our domain, read queued mail (links, PII), drop mail
--   * merge_user_data(source, target)
--       -> re-parent ANY account's credits / press / connections / notifications
--   * match_copilot_memories(user_id, embedding)
--       -> read ANY user's private Kreto memory
--   * create_notification(user_id, ...)           -> spam / phishing in-app
--   * create_bidirectional_connection(a, b, 'accepted')
--       -> forge an accepted connection, which the profiles RLS ("connected
--          user profiles") then turns into read access to the other's FULL
--          profile row. The 2026-09-04 policy fix closed the table path and
--          left this RPC as a back door.
--   * find_matching_unclaimed_profiles -> hands out claim_token to anyone;
--     claim_profile(token, ANY user id) -> overwrites that user's profile.
--   * use_invite_code(code, email, ANY user id) -> sets that user's badge
--   * generate_invite_codes / create_multi_use_code -> mint unlimited codes
--   * get_network_* / get_profiles_by_degree / get_connection_path(ANY id)
--       -> read anyone's connection graph
--   * claim_guest_rsvps(email, ANY user id) -> hijack a guest's event passes
--   * list_share_link_files -> skips the share-link PASSWORD check
--
-- WHAT THIS DOES (no new table, no new column, no data change)
--   1. Server-only functions (called only by edge functions through the
--      service-role client, or by other SECURITY DEFINER functions/triggers):
--      EXECUTE is revoked from PUBLIC/anon/authenticated, granted to
--      service_role only.
--   2. Functions the app really calls as a signed-in user keep their name,
--      signature and result shape. The original body is renamed `<name>_impl`
--      (server-only) and a thin guard wrapper takes its place: external
--      callers (JWT role anon/authenticated) may only act on their own id;
--      server callers (service_role, cron, triggers: no external JWT role)
--      are unchanged.
--   3. create_notification and create_bidirectional_connection are
--      redefined with the consent / link / flood rules below.
--
-- BEHAVIOUR CHANGES (the only user-visible ones)
--   * create_bidirectional_connection: 'accepted' now needs consent evidence
--     (mutual right swipe, or the other party asked first, or the other
--     party messaged the caller, or the other party is the founder welcome
--     account). Without evidence it silently becomes a PENDING request from
--     the caller only (the old code also wrote the reverse pending row, which
--     let the caller "accept" a request nobody sent).
--   * find_matching_unclaimed_profiles no longer returns claim_token (always
--     NULL); the suggestion card only uses it for the claim REQUEST dialog.
--   * use_invite_code only binds a code to an account created in the last 2h
--     whose email matches, once per account.
--   * create_notification: link/action_url must be an in-app path or a
--     kretopia.com / thrivein.io URL, image_url a storage or own-domain URL
--     (otherwise dropped, the notification is still created); text is
--     stripped of tags and capped; >120 notifications per recipient in 10 min
--     are dropped. All 1,339 existing notifications satisfy these rules.
--
-- ROLLBACK: security/rollback-2026-10-09.sql Re-runnable (idempotent).
-- ============================================================================

-- ── 1. server-only functions ────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq', 'email_queue_dispatch',
        'merge_user_data',
        'match_copilot_memories', 'touch_copilot_memory',
        'list_share_link_files', 'log_share_link_view', 'resolve_project_share_link',
        'consume_stage_application', 'increment_promo_use', 'increment_template_usage',
        'find_duplicate_account_candidates',
        'create_multi_use_code', 'validate_invite_code',
        'claim_guest_rsvps',
        'recompute_all_storage_usage', 'recompute_verification_tier', 'record_referral',
        'send_opportunity_alerts', 'thrivefund_auto_finalize_due',
        'can_join_event_online', 'check_storage_available', 'pending_inbox_triage_count',
        'get_guest_brief'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- The 2-argument use_invite_code overload has no caller (the app passes the
-- new user id); keep it server-only.
DO $$
BEGIN
  IF to_regprocedure('public.use_invite_code(text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.use_invite_code(text, text) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.use_invite_code(text, text) TO service_role;
  END IF;
END $$;

-- ── 2. rename originals to <name>_impl (only if not already done) ───────────
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT * FROM (VALUES
      ('get_network_stats',                'uuid'),
      ('get_network_health',               'uuid'),
      ('get_network_industry_breakdown',   'uuid'),
      ('get_profiles_by_degree',           'uuid, integer, integer, integer'),
      ('get_connection_path',              'uuid, uuid'),
      ('claim_profile',                    'text, uuid'),
      ('find_matching_unclaimed_profiles', 'text, integer'),
      ('create_unclaimed_profile',         'text, text, text, text, text, jsonb, jsonb, text, text'),
      ('use_invite_code',                  'text, text, uuid'),
      ('generate_invite_codes',            'uuid, integer'),
      ('auto_join_circles_for_role',       'uuid, text'),
      ('award_founding_member_badge',      'uuid'),
      ('seed_new_user_experience',         'uuid'),
      ('use_partner_code',                 'text, uuid')
    ) AS t(name, args)
  LOOP
    IF to_regprocedure(format('public.%I(%s)', f.name, f.args)) IS NOT NULL
       AND to_regprocedure(format('public.%I(%s)', f.name || '_impl', f.args)) IS NULL THEN
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', f.name, f.args, f.name || '_impl');
    END IF;
  END LOOP;
END $$;

-- ── 3. guard wrappers (same name, signature and result as before) ───────────
-- "External" = the request carries a PostgREST JWT with role anon/authenticated.
-- service_role, cron and trigger callers have no such role and pass through.

CREATE OR REPLACE FUNCTION public.get_network_stats(p_user_id uuid)
RETURNS TABLE(degree integer, connection_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only read your own network' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_network_stats_impl(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_network_health(p_user_id uuid)
RETURNS TABLE(diversity_score integer, connectivity_score integer, growth_potential integer, overall_score integer, unique_roles integer, active_connections integer, pending_requests integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only read your own network' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_network_health_impl(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_network_industry_breakdown(p_user_id uuid)
RETURNS TABLE(role_category text, count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only read your own network' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_network_industry_breakdown_impl(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profiles_by_degree(p_user_id uuid, p_degree integer, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE(user_id uuid, full_name text, avatar_url text, role text, bio text, location text, professional_skills jsonb, badge public.user_badge)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only read your own network' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_profiles_by_degree_impl(p_user_id, p_degree, least(coalesce(p_limit, 50), 100), greatest(coalesce(p_offset, 0), 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_connection_path(from_user_id uuid, to_user_id uuid)
RETURNS TABLE(degree integer, path_user_ids uuid[], path_user_names text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND from_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only trace paths from your own account' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.get_connection_path_impl(from_user_id, to_user_id);
END;
$$;

-- claim_profile: only for yourself (an admin may claim on behalf of a user).
CREATE OR REPLACE FUNCTION public.claim_profile(p_claim_token text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL THEN
      RETURN false;
    END IF;
    IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN public.claim_profile_impl(p_claim_token, p_user_id);
END;
$$;

-- Matching suggestions: signed-in only, and never hand out the claim token.
CREATE OR REPLACE FUNCTION public.find_matching_unclaimed_profiles(p_full_name text, p_limit integer DEFAULT 5)
RETURNS TABLE(user_id uuid, full_name text, role text, bio text, avatar_url text, location text, imported_from_url text, imported_data jsonb, professional_skills jsonb, claim_token text, similarity_score double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.user_id, i.full_name, i.role, i.bio, i.avatar_url, i.location, i.imported_from_url,
         i.imported_data, i.professional_skills, NULL::text, i.similarity_score
  FROM public.find_matching_unclaimed_profiles_impl(p_full_name, least(coalesce(p_limit, 5), 10)) i;
END;
$$;

-- Creating an unclaimed profile is an admin / pipeline action.
CREATE OR REPLACE FUNCTION public.create_unclaimed_profile(
  p_full_name text, p_role text, p_bio text DEFAULT NULL::text, p_avatar_url text DEFAULT NULL::text,
  p_location text DEFAULT NULL::text, p_professional_skills jsonb DEFAULT '[]'::jsonb,
  p_imported_data jsonb DEFAULT '{}'::jsonb, p_imported_from_url text DEFAULT NULL::text,
  p_source text DEFAULT 'admin_created'::text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Admin only' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN public.create_unclaimed_profile_impl(p_full_name, p_role, p_bio, p_avatar_url, p_location,
                                              p_professional_skills, p_imported_data, p_imported_from_url, p_source);
END;
$$;

-- Invite code redemption: only for the account that has just signed up with
-- that very email (the app calls this right after signUp, possibly before the
-- email is confirmed, i.e. without a session, so anon must stay allowed).
CREATE OR REPLACE FUNCTION public.use_invite_code(code text, user_email text, new_user_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF new_user_id IS NULL OR user_email IS NULL OR length(btrim(code)) = 0 THEN
      RETURN false;
    END IF;
    IF auth.uid() IS NOT NULL AND auth.uid() <> new_user_id THEN
      RETURN false;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = new_user_id
        AND lower(u.email) = lower(btrim(user_email))
        AND u.created_at > now() - interval '2 hours'
    ) THEN
      RETURN false;
    END IF;
    IF EXISTS (SELECT 1 FROM public.invites i WHERE i.used_by = new_user_id) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN public.use_invite_code_impl(code, user_email, new_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invite_codes(user_id_param uuid, num_codes integer DEFAULT 10)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR user_id_param IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'You can only create invite codes for yourself' USING ERRCODE = '42501';
    END IF;
    IF coalesce(num_codes, 0) < 1 THEN
      RETURN;
    END IF;
    -- A member never holds more than 20 codes in total.
    IF (SELECT count(*) FROM public.invites i WHERE i.inviter_id = user_id_param) >= 20 THEN
      RETURN;
    END IF;
    num_codes := least(num_codes, 10);
  END IF;
  PERFORM public.generate_invite_codes_impl(user_id_param, num_codes);
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_join_circles_for_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only join circles for yourself' USING ERRCODE = '42501';
  END IF;
  PERFORM public.auto_join_circles_for_role_impl(p_user_id, p_role);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_founding_member_badge(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only claim your own badge' USING ERRCODE = '42501';
  END IF;
  RETURN public.award_founding_member_badge_impl(_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_new_user_experience(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only seed your own workspace' USING ERRCODE = '42501';
  END IF;
  RETURN public.seed_new_user_experience_impl(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.use_partner_code(p_code text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only apply a partner code to your own account' USING ERRCODE = '42501';
  END IF;
  RETURN public.use_partner_code_impl(p_code, p_user_id);
END;
$$;

-- ── 4. functions redefined with new rules ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_bidirectional_connection(
  user1_uuid uuid, user2_uuid uuid, connection_status text DEFAULT 'accepted'::text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_external boolean := coalesce(auth.role(), '') IN ('anon', 'authenticated');
  v_caller uuid := auth.uid();
  v_other uuid;
  v_status text := coalesce(connection_status, 'accepted');
  -- the founder welcome account every new member is connected with
  v_founder constant uuid := 'ef429714-ea32-4f08-a4f9-ef0226f1804b';
BEGIN
  IF user1_uuid IS NULL OR user2_uuid IS NULL THEN
    RAISE EXCEPTION 'Both users are required';
  END IF;
  IF user1_uuid = user2_uuid THEN
    RAISE EXCEPTION 'Cannot connect with yourself';
  END IF;

  IF v_external THEN
    IF v_caller IS NULL OR v_caller NOT IN (user1_uuid, user2_uuid) THEN
      RAISE EXCEPTION 'You can only create connections for your own account' USING ERRCODE = '42501';
    END IF;
    IF v_status NOT IN ('pending', 'accepted') THEN
      RAISE EXCEPTION 'Invalid connection status' USING ERRCODE = '22023';
    END IF;
    v_other := CASE WHEN v_caller = user1_uuid THEN user2_uuid ELSE user1_uuid END;

    IF v_status = 'accepted' AND NOT (
         v_other = v_founder
      OR (
           EXISTS (SELECT 1 FROM public.swipes s WHERE s.user_id = v_caller AND s.target_id = v_other AND s.direction = 'right')
       AND EXISTS (SELECT 1 FROM public.swipes s WHERE s.user_id = v_other AND s.target_id = v_caller AND s.direction = 'right')
      )
      OR EXISTS (SELECT 1 FROM public.connections c WHERE c.user_id = v_other AND c.connected_user_id = v_caller AND c.status IN ('pending', 'accepted'))
      OR EXISTS (SELECT 1 FROM public.messages m WHERE m.sender_id = v_other AND m.receiver_id = v_caller)
    ) THEN
      v_status := 'pending';
    END IF;

    IF v_status = 'pending' THEN
      -- A request goes one way only: the caller asks, the other party decides.
      INSERT INTO public.connections (user_id, connected_user_id, status)
      VALUES (v_caller, v_other, 'pending')
      ON CONFLICT DO NOTHING;
      RETURN;
    END IF;
  END IF;

  -- Server callers, and external callers with consent evidence: both directions.
  INSERT INTO public.connections (user_id, connected_user_id, status)
  VALUES (user1_uuid, user2_uuid, v_status)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.connections (user_id, connected_user_id, status)
  VALUES (user2_uuid, user1_uuid, v_status)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_title text, p_message text, p_type text,
  p_link text DEFAULT NULL::text, p_action_url text DEFAULT NULL::text, p_action_text text DEFAULT NULL::text,
  p_image_url text DEFAULT NULL::text, p_priority text DEFAULT 'normal'::text, p_category text DEFAULT 'general'::text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  notification_id uuid;
  v_external boolean := coalesce(auth.role(), '') IN ('anon', 'authenticated');
  v_title text := p_title;
  v_message text := p_message;
  v_action_text text := p_action_text;
  v_link text := p_link;
  v_action_url text := p_action_url;
  v_image text := p_image_url;
BEGIN
  IF v_external THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'Recipient required' USING ERRCODE = '22023';
    END IF;
    IF p_type IS NULL OR p_type !~ '^[a-z0-9_:\-]{1,40}$' THEN
      RAISE EXCEPTION 'Invalid notification type' USING ERRCODE = '22023';
    END IF;

    -- Links may only point inside the product.
    IF v_link IS NOT NULL AND NOT (v_link ~ '^/[^/\\]' OR v_link ~* '^https://(www\.)?(kretopia\.com|thrivein\.io)(/|$)') THEN
      v_link := NULL;
    END IF;
    IF v_action_url IS NOT NULL AND NOT (v_action_url ~ '^/[^/\\]' OR v_action_url ~* '^https://(www\.)?(kretopia\.com|thrivein\.io)(/|$)') THEN
      v_action_url := NULL;
    END IF;
    IF v_image IS NOT NULL AND NOT (v_image ~* '^https://[a-z0-9.-]+\.supabase\.co/storage/' OR v_image ~* '^https://(www\.)?(kretopia\.com|thrivein\.io)/') THEN
      v_image := NULL;
    END IF;

    v_title := left(regexp_replace(coalesce(p_title, ''), '<[^>]*>', '', 'g'), 140);
    v_message := left(regexp_replace(coalesce(p_message, ''), '<[^>]*>', '', 'g'), 600);
    v_action_text := left(regexp_replace(coalesce(p_action_text, ''), '<[^>]*>', '', 'g'), 40);

    -- Flood guard: never bury a member under notifications.
    IF (SELECT count(*) FROM public.notifications n
         WHERE n.user_id = p_user_id AND n.created_at > now() - interval '10 minutes') >= 120 THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    user_id, title, message, type, link, action_url, action_text, image_url, priority, category
  ) VALUES (
    p_user_id, v_title, v_message, p_type, v_link, v_action_url, v_action_text, v_image, p_priority, p_category
  )
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

-- ── 5. grants for everything touched above ──────────────────────────────────
-- Wrappers: signed-in members and the server. (anon only where the sign-up
-- flow needs it: use_invite_code.)
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.get_network_stats(uuid)',
    'public.get_network_health(uuid)',
    'public.get_network_industry_breakdown(uuid)',
    'public.get_profiles_by_degree(uuid, integer, integer, integer)',
    'public.get_connection_path(uuid, uuid)',
    'public.claim_profile(text, uuid)',
    'public.find_matching_unclaimed_profiles(text, integer)',
    'public.create_unclaimed_profile(text, text, text, text, text, jsonb, jsonb, text, text)',
    'public.generate_invite_codes(uuid, integer)',
    'public.auto_join_circles_for_role(uuid, text)',
    'public.award_founding_member_badge(uuid)',
    'public.seed_new_user_experience(uuid)',
    'public.use_partner_code(text, uuid)',
    'public.create_bidirectional_connection(uuid, uuid, text)',
    'public.create_notification(uuid, text, text, text, text, text, text, text, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
  END LOOP;

  -- Sign-up redeems the code before an email-confirmed session exists.
  REVOKE ALL ON FUNCTION public.use_invite_code(text, text, uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.use_invite_code(text, text, uuid) TO anon, authenticated, service_role;

  -- Originals: server-only.
  FOREACH sig IN ARRAY ARRAY[
    'public.get_network_stats_impl(uuid)',
    'public.get_network_health_impl(uuid)',
    'public.get_network_industry_breakdown_impl(uuid)',
    'public.get_profiles_by_degree_impl(uuid, integer, integer, integer)',
    'public.get_connection_path_impl(uuid, uuid)',
    'public.claim_profile_impl(text, uuid)',
    'public.find_matching_unclaimed_profiles_impl(text, integer)',
    'public.create_unclaimed_profile_impl(text, text, text, text, text, jsonb, jsonb, text, text)',
    'public.use_invite_code_impl(text, text, uuid)',
    'public.generate_invite_codes_impl(uuid, integer)',
    'public.auto_join_circles_for_role_impl(uuid, text)',
    'public.award_founding_member_badge_impl(uuid)',
    'public.seed_new_user_experience_impl(uuid)',
    'public.use_partner_code_impl(text, uuid)'
  ] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
