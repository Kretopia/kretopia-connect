-- LOT C -- verification badge -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. One result row.
--
-- PROVES (catalog): for every privileged column that exists, a signed-in member and anon can neither UPDATE nor INSERT it; the service
-- role still can; ordinary profile columns are still updatable by a signed-in member; anon can update nothing.
-- DOES NOT PROVE: that the app never needed a locked column (the REST calls below, and a click-through of the profile editor, do),
-- nor how PostgREST answers a real caller: the SQL Editor runs as postgres.

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
    'og_promotion_expires_at', 'og_promotion_used', 'phone_otp', 'phone_otp_expires_at', 'phone_number',
    'daily_swipes', 'last_swipe_reset'
  ])
),
cols AS (
  SELECT a.attname::text AS col, a.attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'public.profiles'::regclass AND a.attnum > 0 AND NOT a.attisdropped
),
locked AS (SELECT c.col, c.attnum FROM cols c JOIN priv p ON p.col = c.col)
SELECT
  (SELECT count(*) FROM locked) > 40                                                                       AS enough_privileged_columns_found,
  NOT EXISTS (SELECT 1 FROM locked l WHERE has_column_privilege('authenticated', 'public.profiles', l.attnum, 'UPDATE'))
                                                                                                         AS members_cannot_update_any_privileged_column,
  NOT EXISTS (SELECT 1 FROM locked l WHERE has_column_privilege('authenticated', 'public.profiles', l.attnum, 'INSERT'))
                                                                                                         AS members_cannot_insert_any_privileged_column,
  NOT EXISTS (SELECT 1 FROM locked l WHERE has_column_privilege('anon', 'public.profiles', l.attnum, 'UPDATE')
                                         OR has_column_privilege('anon', 'public.profiles', l.attnum, 'INSERT'))
                                                                                                         AS anon_cannot_write_any_privileged_column,
  NOT has_any_column_privilege('anon', 'public.profiles', 'UPDATE')                                       AS anon_cannot_update_anything,
  NOT has_table_privilege('authenticated', 'public.profiles', 'UPDATE')                                   AS no_table_level_update_left_for_members,
  (SELECT bool_and(has_column_privilege('service_role', 'public.profiles', l.attnum, 'UPDATE')) FROM locked l)
                                                                                                         AS service_role_still_updates_them,
  EXISTS (SELECT 1 FROM cols c WHERE c.col = 'bio' AND has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))
  AND EXISTS (SELECT 1 FROM cols c WHERE c.col = 'full_name' AND has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE'))
                                                                                                         AS ordinary_columns_still_editable,
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = 'public.profiles'::regclass)                     AS rls_enabled,
  (SELECT count(*) FROM cols c WHERE has_column_privilege('authenticated', 'public.profiles', c.attnum, 'UPDATE')) AS informational_columns_members_can_update;

-- ---------------------------------------------------------------------------------------------------------------------
-- The proof the catalog cannot give: REST calls by hand, as an ordinary member (never an admin), on YOUR OWN row.
-- {URL}, {ANON} = public anon key, {USER_TOKEN} = a member's access token (not pasted into a chat), {UID} = that member's user id.
--
--   PATCH {URL}/rest/v1/profiles?user_id=eq.{UID}      apikey: {ANON}   Authorization: Bearer {USER_TOKEN}   Content-Type: application/json
--   body                                     expected
--   {"bio":"probe"}                          204 / 200   (ordinary editing still works; put your bio back)
--   {"verification_status":"verified"}       403  {"code":"42501", ... "permission denied for table profiles"}
--   {"id_verified":true}                     403  42501
--   {"badge":"legend"}                       403  42501
--   {"subscription_tier":"enterprise"}       403  42501
--   {"phone_verified":true}                  403  42501
--   {"phone_otp":"123456","phone_otp_expires_at":"2099-01-01T00:00:00Z"}   403  42501   (the phone code is the server's)
--   {"phone_number":"+10000000000"}          403  42501   (the number changes only through send-phone-otp, which resets the badge)
--   then GET ...?user_id=eq.{UID}&select=bio,verification_status   -> the status is what it was.
--   An admin still verifies through the admin function (admin_verify_profile_identity): call it once as an admin and see it succeed.
-- ---------------------------------------------------------------------------------------------------------------------
