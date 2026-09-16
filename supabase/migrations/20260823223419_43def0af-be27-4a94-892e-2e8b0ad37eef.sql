-- Migration A: wallet_privilege_hardening

-- 1. wallets: no client UPDATE/DELETE; balance changes only via wallet_credit/wallet_debit
REVOKE UPDATE, DELETE ON public.wallets FROM anon, authenticated;
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;
GRANT ALL ON public.wallets TO service_role;

-- 2. creator wallet stack: read-only for clients, writes are service-role/SECDEF only
REVOKE INSERT, UPDATE, DELETE ON public.creator_wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.creator_wallet_balances FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.creator_payouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.creator_payout_methods FROM anon, authenticated;
REVOKE SELECT ON public.creator_wallets, public.creator_wallet_balances, public.creator_payouts, public.creator_payout_methods FROM anon;
GRANT SELECT ON public.creator_wallets TO authenticated;
GRANT SELECT ON public.creator_wallet_balances TO authenticated;
GRANT SELECT ON public.creator_payouts TO authenticated;
GRANT SELECT ON public.creator_payout_methods TO authenticated;
GRANT ALL ON public.creator_wallets TO service_role;
GRANT ALL ON public.creator_wallet_balances TO service_role;
GRANT ALL ON public.creator_payouts TO service_role;
GRANT ALL ON public.creator_payout_methods TO service_role;

DROP POLICY IF EXISTS "own wallet update" ON public.creator_wallets;
DROP POLICY IF EXISTS "own wallet upsert" ON public.creator_wallets;
DROP POLICY IF EXISTS "own methods write" ON public.creator_payout_methods;

-- 3. stripe_webhook_events: service-role only
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

-- 4. profiles: deny-list of server-managed columns for client UPDATE
REVOKE UPDATE (
  stripe_account_id, stripe_account_status, stripe_customer_id, stripe_subscription_id,
  subscription_tier, subscription_status, subscription_product_id, subscription_end_date,
  payment_verified, credit_score, verification_score, verification_status, verification_tier,
  verification_breakdown, verified_at, verified_credentials, verified_metrics,
  id_verified, id_verified_at, identity_face_verified, identity_face_verified_at,
  email_verified, phone_verified, age_verified, portfolio_verified, social_verified,
  imdb_verified, spotify_verified, youtube_verified, instagram_verified, discogs_verified,
  mother_agency_verified, badge, achievement_badges, xp, total_xp, level,
  storage_used_bytes, storage_limit_bytes, available_invites,
  boost_expires_at, double_xp_expires_at, og_promotion_expires_at,
  claim_token, claimed_by, claimed_at, is_claimed, role,
  ambassador_code, icdb_creator_id, membership_number
) ON public.profiles FROM anon, authenticated;
GRANT ALL ON public.profiles TO service_role;