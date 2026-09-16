-- ============================================================
-- Security hardening phase 2 -- CRITICAL. Found via background audit
-- (2026-09-10): the profile_core/profile_creative/profile_business/
-- profile_media/profile_account tables (20260708150000_profile_split_
-- phase1_create_tables.sql, kept in sync with `profiles` by a trigger in
-- 20260708170000) have ZERO GRANT/REVOKE statements anywhere in this
-- repo's tracked history -- meaning every privilege lock already shipped
-- on `profiles` itself (20260502224404: phone_otp SELECT,
-- 20260904150000: subscription/verification/reputation UPDATE) is
-- completely bypassed by querying the split table directly instead:
--
--   - profile_core's "...for discovery" policy (USING (true), no column
--     restriction) exposes phone_otp / phone_otp_expires_at -- a LIVE OTP
--     CODE -- to every authenticated user for every other user's row.
--   - profile_account's UPDATE policy (USING (auth.uid()=user_id), no
--     WITH CHECK, no column restriction) lets any authenticated user set
--     their own subscription_tier, payment_verified, id_verified,
--     identity_face_verified, verification_status/tier/score, xp, level,
--     badge, stripe_account_status directly -- a complete self-service
--     bypass of billing, identity verification, and reputation.
--
-- CORRECTED after a live apply attempt failed
-- (42P01: relation "public.profile_core" does not exist): despite being
-- merged to `main`, 20260708150000_profile_split_phase1_create_tables.sql
-- was never actually applied to production -- another instance of this
-- repo's now-familiar "merged to git != applied to the live database"
-- gap. The vulnerability described above is therefore real IN THE
-- CODEBASE (and would be live the moment that file is ever applied) but
-- was NOT exploitable in production as of this fix. The whole body is
-- now wrapped in a single guarded PL/pgSQL block so this file is safe to
-- run today (a documented no-op) and becomes effective automatically
-- whenever the phase1 file is eventually applied -- no one needs to
-- remember to re-run this afterwards.
--
-- Confirmed via grep across src/: nothing in the frontend reads or
-- writes any of these five tables today (the app still reads/writes
-- `profiles` directly; the split appears to be schema groundwork for a
-- future migration, not yet wired up). This means the fixes below are
-- pure attack-surface closure -- zero behavior change for any shipped
-- feature, verified by the same grep this session already ran for every
-- other pure-gap-fill in this batch.
--
-- Fix shape (unchanged from the original version, just wrapped for
-- safety -- see git history for the pre-guard version if useful):
--   1. profile_core: table-level REVOKE SELECT (phone_otp,
--      phone_otp_expires_at) + re-GRANT every other column -- mirrors
--      20260502224404's fix on `profiles` exactly.
--   2. profile_core/profile_creative/profile_account: table-level
--      REVOKE UPDATE + re-GRANT excluding the same privileged columns
--      20260904150000 already excluded on `profiles` (verification/
--      claim/subscription/billing/reputation), split across whichever
--      table actually holds each column. daily_swipes/last_swipe_reset/
--      referred_by_ambassador are deliberately excluded from the lock,
--      matching that migration's own carve-out for real, working
--      client-writable counters.
--   3. profile_account additionally locks storage_limit_bytes/
--      storage_used_bytes for UPDATE (quota-bypass risk with no
--      equivalent column on `profiles` to mirror).
--   4. profile_creative/profile_business/profile_media: DROP the
--      "...for discovery" blanket SELECT policy outright rather than
--      hand-picking a column exclusion list -- nothing reads these
--      tables today, so there is no discovery behavior to preserve.
--      Owner-only and admin-only SELECT policies are untouched.
--   5. profile_core keeps its "for discovery" policy (unlike the other
--      three) because most of its columns ARE meant to be public,
--      general-browsing profile fields, matching `profiles`' own
--      public-safe default -- the column-level SELECT REVOKE in step 1
--      is the correct, narrower fix there instead of dropping the whole
--      policy.
--
-- Idempotent: every REVOKE/GRANT/DROP POLICY runs through EXECUTE inside
-- this guarded block, safe to re-run any number of times, on a database
-- with or without the profile_* split tables present.
-- ============================================================

DO $$
DECLARE
  _col text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profile_core'
  ) THEN
    RAISE NOTICE 'profile_core does not exist in this database -- skipping profile-split hardening (20260910160000). This is a documented no-op, not an error: harmless to re-run after 20260708150000_profile_split_phase1_create_tables.sql is ever applied.';
    RETURN;
  END IF;

  -- 1. profile_core SELECT -- close the live OTP leak.
  EXECUTE 'REVOKE SELECT ON public.profile_core FROM authenticated, anon';
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_core'
      AND column_name NOT IN ('phone_otp', 'phone_otp_expires_at')
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.profile_core TO authenticated, anon', _col);
  END LOOP;

  -- 2. profile_core UPDATE -- verification/claim columns are server-only.
  EXECUTE 'REVOKE UPDATE ON public.profile_core FROM authenticated, anon';
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_core'
      AND column_name <> ALL(ARRAY[
        'email_verified', 'phone_verified', 'age_verified',
        'is_claimed', 'claimed_at', 'claimed_by', 'claim_token'
      ])
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profile_core TO authenticated', _col);
  END LOOP;

  -- 3. profile_creative -- drop blanket discovery SELECT (unused today),
  --    lock the small set of server-computed/verification columns for UPDATE.
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view profile_creative for discovery" ON public.profile_creative';

  EXECUTE 'REVOKE UPDATE ON public.profile_creative FROM authenticated, anon';
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_creative'
      AND column_name <> ALL(ARRAY['credit_score', 'portfolio_verified', 'mother_agency_verified'])
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profile_creative TO authenticated', _col);
  END LOOP;

  -- 4. profile_business -- drop blanket discovery SELECT (unused today;
  --    was exposing company_address/invite_code_used/team_member_ids to
  --    every authenticated user with no scoping).
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view profile_business for discovery" ON public.profile_business';

  -- 5. profile_media -- drop blanket discovery SELECT (unused today).
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view profile_media for discovery" ON public.profile_media';

  EXECUTE 'REVOKE UPDATE ON public.profile_media FROM authenticated, anon';
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_media'
      AND column_name <> ALL(ARRAY[
        'discogs_verified', 'imdb_verified', 'instagram_verified',
        'spotify_verified', 'youtube_verified', 'social_verified', 'verified_metrics'
      ])
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profile_media TO authenticated', _col);
  END LOOP;

  -- 6. profile_account -- the critical one: complete self-service
  --    escalation of billing/verification/reputation, no discovery policy
  --    involved, this is purely the UPDATE column lock.
  EXECUTE 'REVOKE UPDATE ON public.profile_account FROM authenticated, anon';
  FOR _col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profile_account'
      AND column_name <> ALL(ARRAY[
        -- billing / subscription
        'subscription_tier', 'subscription_status', 'subscription_end_date',
        'subscription_product_id', 'stripe_customer_id', 'stripe_subscription_id',
        'stripe_account_id', 'stripe_account_status', 'payment_verified',
        -- storage quota (no equivalent on `profiles` to mirror; same
        -- self-escalation risk as everything else in this list)
        'storage_limit_bytes', 'storage_used_bytes',
        -- reputation / gamification (server-computed)
        'xp', 'level', 'total_xp', 'badge', 'achievement_badges',
        'streak_count', 'current_streak', 'longest_streak', 'streak_freeze_count',
        'double_xp_expires_at', 'og_promotion_expires_at', 'og_promotion_used',
        'average_rating', 'total_reviews',
        -- verification / identity
        'verification_status', 'verification_tier', 'verification_score',
        'verification_breakdown', 'verification_notes', 'verified_at',
        'verified_credentials', 'id_verified', 'id_verified_at',
        'identity_face_verified', 'identity_face_verified_at'
        -- deliberately excluded (real, working client-writable counters,
        -- matching 20260904150000's own carve-out on `profiles`):
        -- daily_swipes, last_swipe_reset, referred_by_ambassador
      ])
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profile_account TO authenticated', _col);
  END LOOP;
END $$;
