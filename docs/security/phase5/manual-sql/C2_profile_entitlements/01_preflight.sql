-- LOT C2 -- profile entitlement columns -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app", AFTER lot C.
--
-- Four columns of public.profiles hold what the server grants at sign-up: project_credits (a balance), available_invites (an allowance),
-- invite_code_used and invited_by (who brought the member). No browser code writes them (a scan of src/, 66 writes to profiles, found none;
-- updateProfile, which would pass anything through, has no caller) and no migration of the repository updates them after sign-up, yet lot0b
-- showed that a member can write project_credits, invite_code_used and invited_by on their own row. This lot removes that. It leaves
-- referred_by_ambassador (the browser writes it) and preferred_currency (a display preference) alone.
--
-- It stops with an error if the lot cannot work as written. Otherwise it returns one row. Read: writable_today (which of the four members can
-- write now), functions_that_write_them (any function of this database that UPDATEs them, and whether it runs as its owner: one that runs as
-- the caller would start to fail for members), unlisted_denied_columns (columns members cannot write that lot C does not name).

DO $assert$
DECLARE
  v_missing text;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles is missing. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;
  SELECT string_agg(c, ', ') INTO v_missing
  FROM unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS c
  WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = 'public.profiles'::regclass AND a.attname::text = c AND a.attnum > 0 AND NOT a.attisdropped);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: column(s) missing from public.profiles: %. Nothing was changed.', v_missing;
  END IF;
  IF has_table_privilege('authenticated', 'public.profiles', 'UPDATE') OR has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     OR has_table_privilege('anon', 'public.profiles', 'UPDATE') OR has_table_privilege('anon', 'public.profiles', 'INSERT') THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: a member role holds a table-level INSERT or UPDATE on public.profiles, so a column REVOKE would do nothing. Apply lot C first. Nothing was changed.';
  END IF;
END
$assert$;

SELECT
  (SELECT jsonb_object_agg(c, jsonb_build_object(
            'update', has_column_privilege('authenticated', 'public.profiles', c, 'UPDATE'),
            'insert', has_column_privilege('authenticated', 'public.profiles', c, 'INSERT')))
   FROM unnest(ARRAY['project_credits', 'available_invites', 'invite_code_used', 'invited_by']) AS c)                                                         AS writable_today,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('function', p.oid::regprocedure::text, 'security_definer', p.prosecdef)
                             ORDER BY p.oid::regprocedure::text), '[]'::jsonb)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prokind = 'f'
     AND p.prosrc ~* 'update\s+(public\.)?profiles\s+set[^;]*(project_credits|available_invites|invite_code_used|invited_by)\s*=')
                                                                                               AS functions_that_write_them,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('column', a.attname::text,
            'can_update', has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE'),
            'can_insert', has_column_privilege('authenticated', 'public.profiles', a.attnum, 'INSERT')) ORDER BY a.attname::text), '[]'::jsonb)
   FROM pg_attribute a
   WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND NOT has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE')
     AND a.attname::text <> ALL (ARRAY['id_verified', 'id_verified_at', 'id_verification_requested_at', 'identity_face_verified', 'identity_face_verified_at', 'email_verified', 'phone_verified', 'age_verified', 'payment_verified', 'discogs_verified', 'imdb_verified', 'instagram_verified', 'mother_agency_verified', 'portfolio_verified', 'social_verified', 'spotify_verified', 'youtube_verified', 'verified_metrics', 'verification_breakdown', 'verification_notes', 'verification_score', 'verification_status', 'verification_tier', 'verified_at', 'verified_credentials', 'claimed_at', 'claimed_by', 'claim_token', 'achievement_badges', 'subscription_tier', 'subscription_status', 'subscription_end_date', 'subscription_product_id', 'stripe_account_id', 'stripe_account_status', 'stripe_customer_id', 'stripe_subscription_id', 'badge', 'level', 'xp', 'total_xp', 'credit_score', 'average_rating', 'longest_streak', 'streak_count', 'streak_freeze_count', 'double_xp_expires_at', 'total_reviews', 'total_engagement_rate', 'boost_expires_at', 'og_promotion_expires_at', 'og_promotion_used', 'phone_otp', 'phone_otp_expires_at', 'phone_number', 'last_swipe_reset', 'current_streak', 'is_claimed']))                                           AS unlisted_denied_columns,
  (SELECT count(*) FROM pg_attribute a
   WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
     AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE'))       AS informational_columns_members_can_update,
  current_user                                                                               AS informational_running_as,
  'The SQL Editor bypasses RLS: this shows privileges and functions, not how a signed-in caller is treated.' AS limit_of_this_check;
