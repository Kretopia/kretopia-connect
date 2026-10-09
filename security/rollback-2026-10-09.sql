-- Rollback for the 2026-10-09 security migrations. NOT in supabase/migrations on purpose:
-- run only by hand, only the part you need, in the Lovable Cloud SQL editor.
-- Rolling back reopens the holes described in the audit; prefer fixing forward.

-- ── 0400 (event claim policies) ─────────────────────────────────────────────
CREATE POLICY "Anyone can read unclaimed scouted events" ON public.creative_jams
  FOR SELECT TO public USING (claim_status = 'unclaimed' AND claim_token IS NOT NULL);
CREATE POLICY "Authenticated users can claim unclaimed events" ON public.creative_jams
  FOR UPDATE TO authenticated USING (claim_status = 'unclaimed')
  WITH CHECK (created_by = auth.uid() AND claim_status = 'claimed');
CREATE POLICY "Allow public read of active partner links" ON public.partner_invite_links
  FOR SELECT TO public USING (is_active = true);

-- ── 0300 (claim RPCs): additive, safe to leave. Original token generator: ───
CREATE OR REPLACE FUNCTION public.generate_claim_token() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN 'claim_' || SUBSTRING(md5(random()::text || clock_timestamp()::text) FROM 1 FOR 16);
END; $$;

-- ── 0200 (Studio access) ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_guard_project_collaborator_self_update ON public.project_collaborators;
DROP POLICY IF EXISTS "Project members can invite collaborators" ON public.project_collaborators;
CREATE POLICY "Project members can invite collaborators" ON public.project_collaborators
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_collaborators.project_id AND p.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_collaborators.project_id
               AND pc.user_id = auth.uid() AND pc.status = 'accepted'));
DROP POLICY IF EXISTS "Users can view project collaborators" ON public.project_collaborators;
CREATE POLICY "Users can view project collaborators" ON public.project_collaborators
  FOR SELECT USING (user_has_project_access(project_id, auth.uid()));
DROP POLICY IF EXISTS "Users can view accessible projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects
  FOR SELECT TO authenticated USING ((auth.uid() = created_by) OR user_has_project_access(id, auth.uid()));
CREATE OR REPLACE FUNCTION public.user_has_project_access(project_id_param uuid, user_id_param uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id_param AND p.created_by = user_id_param AND p.match_id IS NULL)
  OR EXISTS (SELECT 1 FROM projects p JOIN matches m ON m.id = p.match_id
             WHERE p.id = project_id_param AND (m.user1_id = user_id_param OR m.user2_id = user_id_param))
  OR EXISTS (SELECT 1 FROM project_collaborators pc WHERE pc.project_id = project_id_param
             AND pc.user_id = user_id_param AND pc.status IN ('accepted', 'pending'));
$$;

-- ── 0100 (open policies) ────────────────────────────────────────────────────
CREATE POLICY "Anyone can submit approval via valid link" ON public.share_link_approvals
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can log a view" ON public.share_link_views
  FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Service role can manage opportunity images" ON storage.objects
  FOR ALL TO public USING (bucket_id = 'opportunities') WITH CHECK (bucket_id = 'opportunities');
CREATE POLICY "Service role can write deal memo PDFs" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'deal-memos');
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
CREATE POLICY "Users can delete own media" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'media' AND (storage.foldername(name))[1] = 'circles');

-- ── 0000 (definer functions) ────────────────────────────────────────────────
-- 1. Put the originals back and drop the guard wrappers.
DO $$
DECLARE f record;
BEGIN
  FOR f IN SELECT * FROM (VALUES
      ('get_network_stats','uuid'), ('get_network_health','uuid'), ('get_network_industry_breakdown','uuid'),
      ('get_profiles_by_degree','uuid, integer, integer, integer'), ('get_connection_path','uuid, uuid'),
      ('claim_profile','text, uuid'), ('find_matching_unclaimed_profiles','text, integer'),
      ('create_unclaimed_profile','text, text, text, text, text, jsonb, jsonb, text, text'),
      ('use_invite_code','text, text, uuid'), ('generate_invite_codes','uuid, integer'),
      ('auto_join_circles_for_role','uuid, text'), ('award_founding_member_badge','uuid'),
      ('seed_new_user_experience','uuid'), ('use_partner_code','text, uuid')) AS t(name, args)
  LOOP
    IF to_regprocedure(format('public.%I(%s)', f.name || '_impl', f.args)) IS NOT NULL THEN
      EXECUTE format('DROP FUNCTION public.%I(%s)', f.name, f.args);
      EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I', f.name || '_impl', f.args, f.name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated, service_role', f.name, f.args);
    END IF;
  END LOOP;
END $$;

-- 2. Re-open the server-only functions (only if you really must).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname = ANY (ARRAY[
      'enqueue_email','read_email_batch','delete_email','move_to_dlq','email_queue_dispatch','merge_user_data',
      'match_copilot_memories','touch_copilot_memory','list_share_link_files','log_share_link_view',
      'resolve_project_share_link','consume_stage_application','increment_promo_use','increment_template_usage',
      'find_duplicate_account_candidates','create_multi_use_code','validate_invite_code','claim_guest_rsvps',
      'recompute_all_storage_usage','recompute_verification_tier','record_referral','send_opportunity_alerts',
      'thrivefund_auto_finalize_due','can_join_event_online','check_storage_available',
      'pending_inbox_triage_count','get_guest_brief'])
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.sig);
  END LOOP;
END $$;

-- 3. Original create_bidirectional_connection and create_notification.
CREATE OR REPLACE FUNCTION public.create_bidirectional_connection(user1_uuid uuid, user2_uuid uuid, connection_status text DEFAULT 'accepted'::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF user1_uuid = user2_uuid THEN RAISE EXCEPTION 'Cannot connect with yourself'; END IF;
  INSERT INTO connections (user_id, connected_user_id, status) VALUES (user1_uuid, user2_uuid, connection_status) ON CONFLICT DO NOTHING;
  INSERT INTO connections (user_id, connected_user_id, status) VALUES (user2_uuid, user1_uuid, connection_status) ON CONFLICT DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text,
  p_link text DEFAULT NULL::text, p_action_url text DEFAULT NULL::text, p_action_text text DEFAULT NULL::text,
  p_image_url text DEFAULT NULL::text, p_priority text DEFAULT 'normal'::text, p_category text DEFAULT 'general'::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link, action_url, action_text, image_url, priority, category)
  VALUES (p_user_id, p_title, p_message, p_type, p_link, p_action_url, p_action_text, p_image_url, p_priority, p_category)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_bidirectional_connection(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, text, text, text, text, text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- gig claim by token (20261009100000)
-- The cleared claim tokens were publicly readable and are not recoverable; a scout
-- gets a fresh one from the gig page. Restores the column grant and removes the functions.
-- ============================================================================
GRANT SELECT (claim_token) ON public.opportunities TO anon, authenticated;
DROP FUNCTION IF EXISTS public.get_scouted_opportunity_by_token(text);
DROP FUNCTION IF EXISTS public.claim_scouted_opportunity(text);
DROP FUNCTION IF EXISTS public.get_or_create_opportunity_claim_token(uuid);
NOTIFY pgrst, 'reload schema';
