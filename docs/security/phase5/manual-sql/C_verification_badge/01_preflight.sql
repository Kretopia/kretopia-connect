-- LOT C -- verification badge cannot be self-assigned -- 01 PREFLIGHT. Read-only. Run it in the SQL Editor of "kretopia-app" only.
--
-- The weakness: "Owner full access" on public.profiles checks the row owner and nothing else, so unless UPDATE is restricted by
-- COLUMN, any signed-in member can PATCH their own row and set verification_status, id_verified, badge, subscription_tier, xp...
-- The repository carries the fix (migration 20260904150000_lock_profiles_privileged_columns.sql); whether production has it is exactly
-- what this query shows. This lot also covers three columns the repository's list misses: phone_otp, phone_otp_expires_at and
-- phone_number. The phone code is stored by the server, but a member who can write it can store a code of their own choosing and
-- then "verify" a phone they do not hold; a member who can change phone_number keeps the "phone verified" badge for another number.
--
-- It stops only if the table is missing. Otherwise it returns its findings, section by section (one result):
--   exposed_now         the privileged columns a signed-in member CAN update today (empty = already locked)
--   missing_columns     privileged columns this database does not have (informational; the lot skips them)
--   review_candidates   columns that look privileged and are NOT in the list: this lot does not change them, you decide
--   will_keep_update    the columns a member keeps UPDATE on after the lot (never more than today)
--   will_lose_update    the columns a member loses UPDATE on

DO $pre$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: public.profiles does not exist here. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;
END
$pre$;

WITH priv(col) AS (
  SELECT unnest(ARRAY[
    'id_verified', 'id_verified_at', 'id_verification_requested_at', 'identity_face_verified', 'identity_face_verified_at',
    'email_verified', 'phone_verified', 'age_verified', 'payment_verified', 'discogs_verified', 'imdb_verified', 'instagram_verified',
    'mother_agency_verified', 'portfolio_verified', 'social_verified', 'spotify_verified', 'youtube_verified', 'verified_metrics',
    'verification_breakdown', 'verification_notes', 'verification_score', 'verification_status', 'verification_tier', 'verified_at',
    'verified_credentials', 'is_claimed', 'claimed_at', 'claimed_by', 'claim_token', 'achievement_badges',
    'subscription_tier', 'subscription_status', 'subscription_end_date', 'subscription_product_id',
    'stripe_account_id', 'stripe_account_status', 'stripe_customer_id', 'stripe_subscription_id',
    'badge', 'level', 'xp', 'total_xp', 'credit_score', 'average_rating', 'current_streak', 'longest_streak', 'streak_count',
    'streak_freeze_count', 'double_xp_expires_at', 'total_reviews', 'total_engagement_rate', 'boost_expires_at',
    'og_promotion_expires_at', 'og_promotion_used',
    -- added by this lot (server-written only: send-phone-otp)
    'phone_otp', 'phone_otp_expires_at', 'phone_number',
    -- already revoked by the repository after the lock migration (swipe counters)
    'daily_swipes', 'last_swipe_reset'
  ])
),
cols AS (
  SELECT a.attname::text AS col, a.attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
)
SELECT
  (SELECT coalesce(jsonb_agg(c.col ORDER BY c.col), '[]'::jsonb) FROM cols c JOIN priv p ON p.col = c.col
    WHERE has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))      AS exposed_now,
  (SELECT coalesce(jsonb_agg(p.col ORDER BY p.col), '[]'::jsonb) FROM priv p WHERE p.col NOT IN (SELECT col FROM cols)) AS missing_columns,
  (SELECT coalesce(jsonb_agg(c.col ORDER BY c.col), '[]'::jsonb) FROM cols c
    WHERE c.col ~* 'verif|badge|tier|claim|score|stripe|subscription|credit|founder|admin|premium|trust|paid|ambassador|referr|invite|otp'
      AND c.col NOT IN (SELECT col FROM priv)
      AND has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))      AS review_candidates,
  (SELECT count(*) FROM cols c WHERE c.col NOT IN (SELECT col FROM priv)
      AND has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))      AS will_keep_update,
  (SELECT coalesce(jsonb_agg(c.col ORDER BY c.col), '[]'::jsonb) FROM cols c JOIN priv p ON p.col = c.col
    WHERE has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))      AS will_lose_update,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE')                          AS authenticated_has_table_level_update_today,
  has_any_column_privilege('anon', 'public.profiles', 'UPDATE')                              AS anon_can_update_something_today,
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.profiles'::regclass)        AS rls_enabled;
