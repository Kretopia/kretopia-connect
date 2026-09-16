CREATE OR REPLACE FUNCTION public.seed_new_user_experience(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_existing_projects int;
  v_existing_matches int;
  v_existing_scouted int;
  v_match_count int := 0;
  v_seeded_project boolean := false;
  v_seeded_gig boolean := false;
  v_candidate record;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'user_id required');
  END IF;

  -- 1. Demo Desk project (only if user has no projects yet)
  SELECT count(*) INTO v_existing_projects
  FROM projects
  WHERE created_by = p_user_id;

  IF v_existing_projects = 0 THEN
    INSERT INTO projects (
      title, description, created_by, workspace_type, deal_type,
      status, mood, setup_completed
    ) VALUES (
      'Welcome to your Studio',
      'A sample project to show you around ThriveDesk. Edit, rename, or delete it anytime — your real work starts when you create your next one.',
      p_user_id, 'general', 'paid', 'active', 'focused', false
    )
    RETURNING id INTO v_project_id;

    INSERT INTO project_tasks (project_id, title, description, status, priority, created_by) VALUES
      (v_project_id, 'Take the 60-second Studio tour', 'Tap any tab to explore Brief, Tasks, Vault, Money, and the Copilot.', 'todo', 'high', p_user_id),
      (v_project_id, 'Add your first ThriveCredit', 'Claim a past project on your profile to unlock Smart Match.', 'todo', 'normal', p_user_id),
      (v_project_id, 'Invite a collaborator', 'Add anyone to this project — they can be a creative, a client, or a guest.', 'todo', 'normal', p_user_id);

    INSERT INTO project_deliverables (
      project_id, title, description, status, source, submitted_by
    ) VALUES (
      v_project_id, 'Your first deliverable',
      'Drop a file or paste a link to see how reviews and approvals work.',
      'pending', 'manual', p_user_id
    );

    v_seeded_project := true;
  END IF;

  -- 2. Suggested matches (3 active creators, excluding self & founder, only if user has no creator matches yet)
  SELECT count(*) INTO v_existing_matches
  FROM matches
  WHERE (user1_id = p_user_id OR user2_id = p_user_id)
    AND match_type = 'creator';

  IF v_existing_matches < 3 THEN
    FOR v_candidate IN
      SELECT p.user_id
      FROM profiles p
      WHERE p.user_id <> p_user_id
        AND p.user_id <> 'ef429714-ea32-4f08-a4f9-ef0226f1804b'::uuid
        AND p.onboarding_completed = true
        AND p.avatar_url IS NOT NULL
        AND p.role IS NOT NULL
        AND coalesce(p.account_type, 'creative') <> 'company'
        AND NOT EXISTS (
          SELECT 1 FROM matches m
          WHERE m.match_type = 'creator'
            AND ((m.user1_id = p_user_id AND m.user2_id = p.user_id)
              OR (m.user1_id = p.user_id AND m.user2_id = p_user_id))
        )
      ORDER BY p.updated_at DESC NULLS LAST
      LIMIT (3 - v_existing_matches)
    LOOP
      BEGIN
        INSERT INTO matches (user1_id, user2_id, match_type, status)
        VALUES (p_user_id, v_candidate.user_id, 'creator', 'active')
        ON CONFLICT DO NOTHING;
        v_match_count := v_match_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- skip dupes / fk issues silently
        NULL;
      END;
    END LOOP;
  END IF;

  -- 3. Demo scouted gig (only if user has no scouted gigs yet)
  SELECT count(*) INTO v_existing_scouted
  FROM scouted_gigs
  WHERE target_user_id = p_user_id;

  IF v_existing_scouted = 0 THEN
    INSERT INTO scouted_gigs (
      target_user_id, source, source_name, source_url, title, company,
      location, remote, description, compensation, apply_url,
      skills, tags, fit_score, fit_reason, dedupe_key, posted_at
    ) VALUES (
      p_user_id, 'thrivein', 'ThriveIN Scout',
      'https://www.thrivein.io/gigs',
      'Brand Photographer — Lifestyle Campaign (Sample)',
      'Demo Brand Co.', 'Remote', true,
      'This is a sample gig from your Smart Gig Scout. Real opportunities are scouted across the web, LinkedIn, IG, and ATS boards every morning. Open it to see how the apply flow works — or dismiss it.',
      '$1,500–$3,000', 'https://www.thrivein.io/gigs',
      ARRAY['Photography', 'Lifestyle', 'Studio'],
      ARRAY['sample', 'welcome'],
      88, 'Matches your role and shows how Scout ranks fit.',
      'demo-welcome-' || p_user_id::text,
      now() - interval '1 hour'
    )
    ON CONFLICT (target_user_id, dedupe_key) DO NOTHING;
    v_seeded_gig := true;
  END IF;

  RETURN jsonb_build_object(
    'project_seeded', v_seeded_project,
    'project_id', v_project_id,
    'matches_added', v_match_count,
    'scouted_gig_seeded', v_seeded_gig
  );
END;
$$;

-- Allow authenticated users to call for themselves
REVOKE ALL ON FUNCTION public.seed_new_user_experience(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_new_user_experience(uuid) TO authenticated;