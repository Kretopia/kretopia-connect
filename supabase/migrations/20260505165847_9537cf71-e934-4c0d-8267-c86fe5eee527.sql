-- ============================================================================
-- ACCOUNT MERGE + IDENTITY VERIFICATION FOUNDATION
-- ============================================================================

-- 1. account_merge_requests: tracks pending merges with dual OTP verification
CREATE TABLE public.account_merge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_user_id UUID NOT NULL,            -- the logged-in user driving the merge
  source_user_id UUID NOT NULL,               -- account that will be MERGED INTO target (will be deleted)
  target_user_id UUID NOT NULL,               -- account that will SURVIVE
  source_email TEXT NOT NULL,
  target_email TEXT NOT NULL,
  source_otp_hash TEXT NOT NULL,
  target_otp_hash TEXT NOT NULL,
  source_verified_at TIMESTAMPTZ,
  target_verified_at TIMESTAMPTZ,
  face_match_score NUMERIC(3,2),              -- optional, 0..1
  status TEXT NOT NULL DEFAULT 'pending',     -- pending | verified | completed | cancelled | expired | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '20 minutes',
  completed_at TIMESTAMPTZ,
  CONSTRAINT chk_distinct_accounts CHECK (source_user_id <> target_user_id)
);

CREATE INDEX idx_amr_initiator ON public.account_merge_requests(initiator_user_id, status);
CREATE INDEX idx_amr_status ON public.account_merge_requests(status, expires_at);

ALTER TABLE public.account_merge_requests ENABLE ROW LEVEL SECURITY;

-- Only the initiator can read their own merge requests
CREATE POLICY "Users can view their own merge requests"
ON public.account_merge_requests FOR SELECT TO authenticated
USING (auth.uid() = initiator_user_id);

-- Inserts/updates only via security-definer edge functions — no direct client writes
CREATE POLICY "No direct client inserts"
ON public.account_merge_requests FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct client updates"
ON public.account_merge_requests FOR UPDATE TO authenticated
USING (false) WITH CHECK (false);

-- 2. Detection RPC: finds likely-duplicate accounts for a given user
CREATE OR REPLACE FUNCTION public.find_duplicate_account_candidates(p_user_id UUID)
RETURNS TABLE (
  candidate_user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  match_email_local BOOLEAN,
  match_phone BOOLEAN,
  match_name BOOLEAN,
  overlap_count INTEGER,
  confidence NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  me_email TEXT;
  me_local TEXT;
  me_phone TEXT;
  me_name  TEXT;
BEGIN
  -- Pull my reference signals from auth.users + profiles
  SELECT u.email, p.phone_number, p.full_name
    INTO me_email, me_phone, me_name
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.id = p_user_id;

  IF me_email IS NULL THEN
    RETURN;
  END IF;

  me_local := lower(split_part(me_email, '@', 1));

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.user_id,
      p.full_name,
      p.avatar_url,
      u.email AS cand_email,
      p.phone_number AS cand_phone
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id <> p_user_id
  ),
  scored AS (
    SELECT
      c.user_id AS candidate_user_id,
      c.full_name,
      c.avatar_url,
      (lower(split_part(c.cand_email, '@', 1)) = me_local) AS match_email_local,
      (me_phone IS NOT NULL AND c.cand_phone = me_phone) AS match_phone,
      (me_name IS NOT NULL AND c.full_name IS NOT NULL
        AND similarity(lower(c.full_name), lower(me_name)) >= 0.7) AS match_name,
      (
        SELECT COUNT(*)::INTEGER FROM public.connections k1
        JOIN public.connections k2
          ON k2.connected_user_id = k1.connected_user_id
         AND k2.user_id = c.user_id
        WHERE k1.user_id = p_user_id
      ) AS overlap_count
    FROM candidates c
  )
  SELECT
    s.candidate_user_id,
    s.full_name,
    s.avatar_url,
    s.match_email_local,
    s.match_phone,
    s.match_name,
    s.overlap_count,
    (
      (CASE WHEN s.match_phone THEN 0.9 ELSE 0 END)
      + (CASE WHEN s.match_email_local THEN 0.4 ELSE 0 END)
      + (CASE WHEN s.match_name THEN 0.3 ELSE 0 END)
      + LEAST(s.overlap_count, 5) * 0.05
    )::NUMERIC AS confidence
  FROM scored s
  WHERE s.match_phone OR s.match_email_local OR s.match_name OR s.overlap_count >= 3
  ORDER BY confidence DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_duplicate_account_candidates(UUID) TO authenticated;

-- Ensure pg_trgm available for similarity()
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Core merge function — re-parents data, then deletes source profile.
-- Auth user deletion is performed by the edge function via admin API after this returns.
CREATE OR REPLACE FUNCTION public.merge_user_data(
  p_source_user_id UUID,
  p_target_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved JSONB := '{}'::JSONB;
  rc INTEGER;
BEGIN
  IF p_source_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot merge an account into itself';
  END IF;

  -- Re-parent owned content. Each block uses ON CONFLICT DO NOTHING semantics
  -- where unique constraints exist; otherwise plain UPDATE.

  UPDATE public.credits SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS rc = ROW_COUNT; moved := moved || jsonb_build_object('credits', rc);

  UPDATE public.awards SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS rc = ROW_COUNT; moved := moved || jsonb_build_object('awards', rc);

  UPDATE public.press_links SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  GET DIAGNOSTICS rc = ROW_COUNT; moved := moved || jsonb_build_object('press_links', rc);

  -- Connections: drop ones that would become self-connections, then move the rest
  DELETE FROM public.connections
    WHERE (user_id = p_source_user_id AND connected_user_id = p_target_user_id)
       OR (user_id = p_target_user_id AND connected_user_id = p_source_user_id);
  UPDATE public.connections SET user_id = p_target_user_id WHERE user_id = p_source_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.connections c2
      WHERE c2.user_id = p_target_user_id AND c2.connected_user_id = connections.connected_user_id
    );
  UPDATE public.connections SET connected_user_id = p_target_user_id WHERE connected_user_id = p_source_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.connections c3
      WHERE c3.user_id = connections.user_id AND c3.connected_user_id = p_target_user_id
    );
  DELETE FROM public.connections WHERE user_id = p_source_user_id OR connected_user_id = p_source_user_id;

  -- Generic content tables
  UPDATE public.notifications SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.xp_activities SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.transactions SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.expenses SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.feed_posts SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.project_collaborators SET user_id = p_target_user_id WHERE user_id = p_source_user_id;
  UPDATE public.saved_opportunities SET user_id = p_target_user_id WHERE user_id = p_source_user_id;

  -- Merge profile fields: keep target as base, fill nulls from source
  UPDATE public.profiles t SET
    bio                  = COALESCE(t.bio, s.bio),
    avatar_url           = COALESCE(t.avatar_url, s.avatar_url),
    location             = COALESCE(t.location, s.location),
    website              = COALESCE(t.website, s.website),
    linkedin_url         = COALESCE(t.linkedin_url, s.linkedin_url),
    instagram_url        = COALESCE(t.instagram_url, s.instagram_url),
    youtube_url          = COALESCE(t.youtube_url, s.youtube_url),
    tiktok_url           = COALESCE(t.tiktok_url, s.tiktok_url),
    spotify_url          = COALESCE(t.spotify_url, s.spotify_url),
    soundcloud_url       = COALESCE(t.soundcloud_url, s.soundcloud_url),
    imdb_url             = COALESCE(t.imdb_url, s.imdb_url),
    behance_url          = COALESCE(t.behance_url, s.behance_url),
    project_credits      = COALESCE(t.project_credits, 0) + COALESCE(s.project_credits, 0),
    xp                   = COALESCE(t.xp, 0) + COALESCE(s.xp, 0)
  FROM public.profiles s
  WHERE t.user_id = p_target_user_id AND s.user_id = p_source_user_id;

  -- Tombstone source profile (we'll delete after auth user delete)
  UPDATE public.profiles SET
    full_name = COALESCE(full_name,'') || ' (merged)',
    onboarding_completed = false
  WHERE user_id = p_source_user_id;

  RETURN moved || jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_user_data(UUID, UUID) FROM PUBLIC;
-- Only callable by service role (edge functions)

-- 4. Profile flag bookkeeping for identity verification on claim
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_face_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_face_verified_at TIMESTAMPTZ;