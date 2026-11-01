-- LOT C -- verification badge cannot be self-assigned -- 02 APPLY. Run it ONLY in the SQL Editor of "kretopia-app", after 01_preflight.sql.
-- One transaction. It only NARROWS what a signed-in member may update or insert on public.profiles; it never grants more than today and
-- deletes nothing.
--
-- How: PostgreSQL ignores a column-level REVOKE while the role holds UPDATE on the whole table, so the lot (1) records the columns a member
-- may update today MINUS the privileged ones, (2) revokes UPDATE on the table from authenticated and anon, (3) grants UPDATE back on
-- the recorded columns only. Legitimate attribution is untouched: the service role (payment webhooks, edge functions) keeps full access,
-- and SECURITY DEFINER functions such as admin_verify_profile_identity run as their owner, not as the member.
--
-- Compatibility with the code deployed today: the app writes none of the privileged columns directly (the repository's own migration
-- says so and checked it); phone_number, phone_otp and phone_otp_expires_at are written only by send-phone-otp with the service role.
-- Order: SQL first, then nothing to deploy. Business risk: a front-end call that PATCHes one of the locked columns starts to fail with
-- "permission denied for table profiles" (HTTP 403); the REST calls at the end of 03_verify.sql show the expected answers.

BEGIN;

DO $assert$
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: public.profiles is missing. Nothing was changed.';
  END IF;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role')) <> 3 THEN
    RAISE EXCEPTION 'APPLY STOPPED: anon, authenticated or service_role is missing. Nothing was changed.';
  END IF;
END
$assert$;

-- (1) what a member may update today, minus the privileged columns
CREATE TEMP TABLE _profile_cols_kept ON COMMIT DROP AS
SELECT a.attname::text AS col
FROM pg_attribute a
WHERE a.attrelid = 'public.profiles'::regclass
  AND a.attnum > 0 AND NOT a.attisdropped
  AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'UPDATE')
  AND a.attname::text <> ALL (ARRAY[
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
    'phone_otp', 'phone_otp_expires_at', 'phone_number',
    'daily_swipes', 'last_swipe_reset'
  ]);

-- The same narrowing for INSERT: a member whose profile row does not exist yet could otherwise create it with a verification status
-- already set. (Profile rows are normally created by the sign-up trigger, so this is a second line, not the first.)
CREATE TEMP TABLE _profile_cols_kept_insert ON COMMIT DROP AS
SELECT a.attname::text AS col
FROM pg_attribute a
WHERE a.attrelid = 'public.profiles'::regclass
  AND a.attnum > 0 AND NOT a.attisdropped
  AND has_column_privilege('authenticated', 'public.profiles', a.attnum, 'INSERT')
  AND a.attname::text IN (SELECT col FROM _profile_cols_kept);

DO $guard$
BEGIN
  -- A member must keep being able to edit their ordinary profile; if the list came out empty something is wrong with this database.
  IF (SELECT count(*) FROM _profile_cols_kept) < 5 THEN
    RAISE EXCEPTION 'APPLY STOPPED: only % ordinary column(s) are updatable today; this does not look like the expected profiles table. Nothing was changed.', (SELECT count(*) FROM _profile_cols_kept);
  END IF;
END
$guard$;

-- (2) revoke, (3) grant back the recorded columns
REVOKE UPDATE, INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

DO $grant$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT col FROM _profile_cols_kept ORDER BY col LOOP
    EXECUTE format('GRANT UPDATE (%I) ON TABLE public.profiles TO authenticated', c.col);
  END LOOP;
  FOR c IN SELECT col FROM _profile_cols_kept_insert ORDER BY col LOOP
    EXECUTE format('GRANT INSERT (%I) ON TABLE public.profiles TO authenticated', c.col);
  END LOOP;
END
$grant$;

GRANT ALL ON TABLE public.profiles TO service_role;

COMMIT;

SELECT 'applied' AS result, 'now run 03_verify.sql, then the REST calls at its end' AS next_step;
