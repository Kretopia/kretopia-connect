-- Migration A part 2: enforce profiles write allow-list
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name NOT IN (
      'id','user_id','created_at',
      'stripe_account_id','stripe_account_status','stripe_customer_id','stripe_subscription_id',
      'subscription_tier','subscription_status','subscription_product_id','subscription_end_date',
      'payment_verified','credit_score','verification_score','verification_status','verification_tier',
      'verification_breakdown','verified_at','verified_credentials','verified_metrics',
      'id_verified','id_verified_at','identity_face_verified','identity_face_verified_at',
      'email_verified','phone_verified','age_verified','portfolio_verified','social_verified',
      'imdb_verified','spotify_verified','youtube_verified','instagram_verified','discogs_verified',
      'mother_agency_verified','badge','achievement_badges','xp','total_xp','level',
      'storage_used_bytes','storage_limit_bytes','available_invites',
      'boost_expires_at','double_xp_expires_at','og_promotion_expires_at',
      'claim_token','claimed_by','claimed_at','is_claimed','role',
      'ambassador_code','icdb_creator_id','membership_number'
    );

  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', cols);
END $$;

GRANT ALL ON public.profiles TO service_role;