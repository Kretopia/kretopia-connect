-- Critical flagged by the deep security scan: "Users can self-grant
-- verification, subscription, and reputation status" (and its close
-- relative, "self-verify their own credit to the highest 'enterprise'
-- trust tier" -- 'enterprise' is a profiles.subscription_tier value, not
-- a credits.verification_status one; both findings share this root cause).
--
-- Root cause: "Owner full access" ON public.profiles is `FOR ALL USING
-- (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` -- it only
-- checks row ownership, with zero column restriction. Every trust/money/
-- reputation signal on this table (subscription_tier, id_verified,
-- verification_status, badge, xp, ...) is just as directly client-
-- writable as full_name or bio. Any authenticated user can PATCH their
-- own row and set subscription_tier: 'enterprise', id_verified: true,
-- badge: 'legend', xp: 999999999 -- bypassing payment, identity
-- verification, and every reputation mechanic entirely, with nothing
-- server-side ever validating the new value.
--
-- Confirmed via grep: no current frontend insert/update call site writes
-- any of the columns revoked below (checked subscription_tier,
-- verification_status, verification_tier, stripe_customer_id,
-- stripe_subscription_id, id_verification_requested_at explicitly, and
-- the full update-call inventory for the rest) -- these are all either
-- unused by any UI today or genuinely meant to be set only by payment
-- webhooks / verification RPCs / admin tooling. Two adjacent-looking
-- columns were deliberately left OUT of this list because they ARE
-- written directly by real features today (daily_swipes/last_swipe_reset
-- for the swipe-limit counter, referred_by_ambassador for referral
-- entry) -- those are a different problem (client-trusted counters/
-- referral attribution), not what this finding describes, and blocking
-- them would break working features without being asked to.
--
-- Fix: same REVOKE-then-narrow-GRANT column-level pattern already used
-- for milestones and project_credits in this repo. Uses an EXCLUSION
-- list (grant everything except the named privileged columns) rather
-- than an allowlist, matching the existing precedent for `projects`'
-- financial columns in 20260825100000_studio_role_based_money_rls.sql --
-- this table has 100+ actively-growing columns; an allowlist would
-- silently make every newly-added ordinary profile field uneditable.
-- The RLS row-ownership check (auth.uid() = user_id) is untouched --
-- this only adds a column-level restriction on top of it.

REVOKE UPDATE ON public.profiles FROM authenticated, anon;

DO $$
DECLARE
  _col text;
  _privileged text[] := ARRAY[
    -- verification / trust
    'id_verified', 'id_verified_at', 'id_verification_requested_at',
    'identity_face_verified', 'identity_face_verified_at',
    'email_verified', 'phone_verified', 'age_verified', 'payment_verified',
    'discogs_verified', 'imdb_verified', 'instagram_verified',
    'mother_agency_verified', 'portfolio_verified', 'social_verified',
    'spotify_verified', 'youtube_verified', 'verified_metrics',
    'verification_breakdown', 'verification_notes', 'verification_score',
    'verification_status', 'verification_tier', 'verified_at',
    'verified_credentials',
    'is_claimed', 'claimed_at', 'claimed_by', 'claim_token',
    'achievement_badges',
    -- subscription / billing
    'subscription_tier', 'subscription_status', 'subscription_end_date',
    'subscription_product_id',
    'stripe_account_id', 'stripe_account_status', 'stripe_customer_id',
    'stripe_subscription_id',
    -- reputation / gamification (server-computed)
    'badge', 'level', 'xp', 'total_xp', 'credit_score', 'average_rating',
    'current_streak', 'longest_streak', 'streak_count',
    'streak_freeze_count', 'double_xp_expires_at', 'total_reviews',
    'total_engagement_rate', 'boost_expires_at', 'og_promotion_expires_at',
    'og_promotion_used'
  ];
BEGIN
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name <> ALL(_privileged)
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated', _col);
  END LOOP;
END $$;
