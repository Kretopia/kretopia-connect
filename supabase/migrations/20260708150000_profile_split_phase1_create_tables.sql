-- Profile table split — Phase 1: create normalized child tables
-- Anchor table `profiles` (id, user_id) is unchanged; columns remain until backfill + contract phases.
-- Column groupings: docs/plan profile_table_split

-- =============================================================================
-- profile_core — identity, location, onboarding, claim
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_core (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  full_name text NOT NULL DEFAULT 'New User',
  username text,
  bio text,
  avatar_url text,
  cover_image_url text,
  role text NOT NULL DEFAULT 'Creator',
  sub_roles text[],
  job_title text,
  account_type public.account_type NOT NULL DEFAULT 'individual',

  location text,
  latitude numeric,
  longitude numeric,
  location_precision public.location_precision,
  location_updated_at timestamptz,
  location_visible boolean,

  date_of_birth date,
  age_verified boolean NOT NULL DEFAULT false,
  phone_number text,
  phone_verified boolean NOT NULL DEFAULT false,
  phone_otp text,
  phone_otp_expires_at timestamptz,
  email_verified boolean NOT NULL DEFAULT false,

  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step integer,
  onboarding_started_at timestamptz,
  onboarding_reminder_sent boolean,
  tour_completed boolean DEFAULT false,

  is_claimed boolean DEFAULT true,
  claim_token text UNIQUE,
  claimed_at timestamptz,
  claimed_by uuid REFERENCES auth.users(id),
  is_manager_mode boolean DEFAULT false,
  is_hidden_backer boolean NOT NULL DEFAULT false,

  ui_vibe text NOT NULL DEFAULT 'daylight',
  profile_frame text,
  profile_source text DEFAULT 'user_created',
  imported_data jsonb DEFAULT '{}'::jsonb,
  imported_from_url text,
  membership_number text,
  preferred_currency text NOT NULL DEFAULT 'USD',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profile_core_ui_vibe_check CHECK (ui_vibe IN ('daylight', 'midnight', 'neon'))
);

COMMENT ON TABLE public.profile_core IS 'Normalized profile identity, location, onboarding, and claim fields (split from profiles).';

-- =============================================================================
-- profile_creative — skills, rates, portfolio, creator site, availability
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_creative (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  passport_profession text,
  professional_skills jsonb DEFAULT '[]'::jsonb,
  passion_skills jsonb DEFAULT '[]'::jsonb,
  industry text,

  hourly_rate numeric,
  project_rate numeric,
  rate_range text,
  rate_currency text DEFAULT 'USD',
  credit_score integer DEFAULT 0,
  project_credits integer,

  portfolio_verified boolean,
  polaroids jsonb,
  comp_card_layout jsonb,
  section_order jsonb,
  awards jsonb,
  video_intro_url text,

  model_categories text[],
  model_stats jsonb,
  model_unions text[],
  mother_agency text,
  mother_agency_verified boolean,
  agency_representation jsonb,
  icdb_creator_id text,

  site_enabled boolean,
  site_headline text,
  site_bio text,
  site_sections jsonb,
  site_template text,
  site_custom_blocks jsonb,

  availability_status text,
  availability_note text,
  available_from date,
  bookings_enabled boolean NOT NULL DEFAULT false,
  calendly_url text,

  collab_intent text,
  primary_intent text,
  primary_intents text[] DEFAULT '{}'::text[],
  intent_set_at timestamptz,
  intent_week_start date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT profile_creative_primary_intent_check CHECK (
    primary_intent IS NULL OR primary_intent IN ('collaborate', 'gigs', 'fund', 'hire', 'manage')
  )
);

COMMENT ON TABLE public.profile_creative IS 'Normalized creative skills, rates, portfolio, and site-builder fields (split from profiles).';

-- =============================================================================
-- profile_business — company info, referrals, team
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_business (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  company_name text,
  company_tagline text,
  company_about text,
  company_address text,
  company_industry text,
  company_size text,
  company_logo_url text,
  company_images jsonb,
  company_location_lat numeric,
  company_location_lng numeric,

  website text,
  google_maps_place_id text,
  team_member_ids uuid[],

  partner_code_used text,
  partner_location_id uuid,
  invite_code_used text,
  invited_by uuid,
  available_invites integer,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profile_business IS 'Normalized company and business fields (split from profiles).';

-- =============================================================================
-- profile_media — social links, press, platform stats
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  press_links jsonb,

  behance_url text,
  imdb_url text,
  instagram_url text,
  linkedin_url text,
  soundcloud_url text,
  spotify_url text,
  tiktok_url text,
  twitter_url text,
  vimeo_url text,
  youtube_url text,

  instagram_followers integer,
  linkedin_connections integer,
  spotify_listeners integer,
  tiktok_followers integer,
  twitter_followers integer,
  youtube_subscribers integer,
  avg_views numeric,
  total_engagement_rate numeric,

  instagram_verified boolean,
  discogs_verified boolean,
  imdb_verified boolean,
  spotify_verified boolean,
  youtube_verified boolean,
  social_verified boolean,
  verified_metrics boolean,

  last_universe_scan_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profile_media IS 'Normalized social, press, and platform media fields (split from profiles).';

-- =============================================================================
-- profile_account — billing, gamification, verification, growth
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,

  subscription_tier text,
  subscription_status text,
  subscription_end_date timestamptz,
  subscription_product_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_account_id text,
  stripe_account_status text,
  payment_verified boolean NOT NULL DEFAULT false,

  storage_limit_bytes bigint,
  storage_used_bytes bigint,

  xp integer,
  level integer,
  total_xp integer,
  badge public.user_badge,
  achievement_badges text[],

  streak_count integer,
  current_streak integer,
  longest_streak integer,
  last_checkin_date date,
  last_active_date date,
  streak_freeze_count integer,
  daily_swipes integer,
  last_swipe_reset timestamptz,

  boost_expires_at timestamptz,
  double_xp_expires_at timestamptz,
  og_promotion_expires_at timestamptz,
  og_promotion_used boolean,

  average_rating numeric,
  total_reviews integer,
  avg_response_hours numeric,

  verification_status text,
  verification_tier text,
  verification_score integer,
  verification_breakdown jsonb,
  verification_notes text,
  verified_at timestamptz,
  verified_credentials jsonb,

  id_verified boolean NOT NULL DEFAULT false,
  id_verified_at timestamptz,
  identity_face_verified boolean NOT NULL DEFAULT false,
  identity_face_verified_at timestamptz,

  ambassador_code text,
  referred_by_ambassador uuid,
  day2_engagement_sent_at timestamptz,
  day5_engagement_sent_at timestamptz,
  review_share_token text UNIQUE,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profile_account IS 'Normalized billing, gamification, verification, and growth fields (split from profiles).';

-- =============================================================================
-- Indexes (hot paths from current profiles usage)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profile_core_profile_id ON public.profile_core(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_core_user_id ON public.profile_core(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_core_username ON public.profile_core(username) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_core_location ON public.profile_core(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_core_is_claimed ON public.profile_core(is_claimed);
CREATE INDEX IF NOT EXISTS idx_profile_core_claim_token ON public.profile_core(claim_token) WHERE claim_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_core_onboarding_completed ON public.profile_core(onboarding_completed);

CREATE INDEX IF NOT EXISTS idx_profile_creative_profile_id ON public.profile_creative(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_creative_user_id ON public.profile_creative(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_creative_passport_profession ON public.profile_creative(passport_profession)
  WHERE passport_profession IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_creative_primary_intent ON public.profile_creative(primary_intent)
  WHERE primary_intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_creative_collab_intent ON public.profile_creative(collab_intent)
  WHERE collab_intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_business_profile_id ON public.profile_business(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_business_user_id ON public.profile_business(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_business_company_name ON public.profile_business(company_name)
  WHERE company_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profile_media_profile_id ON public.profile_media(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_media_user_id ON public.profile_media(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_media_social_links ON public.profile_media USING GIN(social_links);

CREATE INDEX IF NOT EXISTS idx_profile_account_profile_id ON public.profile_account(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_account_user_id ON public.profile_account(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_account_subscription_tier ON public.profile_account(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_profile_account_stripe_account_id ON public.profile_account(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_account_badge ON public.profile_account(badge);
CREATE INDEX IF NOT EXISTS idx_profile_account_verification_tier ON public.profile_account(verification_tier);
CREATE INDEX IF NOT EXISTS idx_profile_account_achievement_badges ON public.profile_account USING GIN(achievement_badges);
CREATE INDEX IF NOT EXISTS idx_profile_account_ambassador_code ON public.profile_account(ambassador_code)
  WHERE ambassador_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_account_referred_by_ambassador ON public.profile_account(referred_by_ambassador)
  WHERE referred_by_ambassador IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profile_account_review_share_token ON public.profile_account(review_share_token)
  WHERE review_share_token IS NOT NULL;

-- =============================================================================
-- updated_at triggers
-- =============================================================================
DROP TRIGGER IF EXISTS update_profile_core_updated_at ON public.profile_core;
CREATE TRIGGER update_profile_core_updated_at
  BEFORE UPDATE ON public.profile_core
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_creative_updated_at ON public.profile_creative;
CREATE TRIGGER update_profile_creative_updated_at
  BEFORE UPDATE ON public.profile_creative
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_business_updated_at ON public.profile_business;
CREATE TRIGGER update_profile_business_updated_at
  BEFORE UPDATE ON public.profile_business
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_media_updated_at ON public.profile_media;
CREATE TRIGGER update_profile_media_updated_at
  BEFORE UPDATE ON public.profile_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profile_account_updated_at ON public.profile_account;
CREATE TRIGGER update_profile_account_updated_at
  BEFORE UPDATE ON public.profile_account
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS (tables are empty until backfill; policies mirror profiles ownership model)
-- =============================================================================
ALTER TABLE public.profile_core ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_creative ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_business ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_account ENABLE ROW LEVEL SECURITY;

-- profile_core
CREATE POLICY "Users can view own profile_core"
  ON public.profile_core FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view profile_core for discovery"
  ON public.profile_core FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile_core"
  ON public.profile_core FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile_core"
  ON public.profile_core FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile_core"
  ON public.profile_core FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- profile_creative
CREATE POLICY "Users can view own profile_creative"
  ON public.profile_creative FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view profile_creative for discovery"
  ON public.profile_creative FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile_creative"
  ON public.profile_creative FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile_creative"
  ON public.profile_creative FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile_creative"
  ON public.profile_creative FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- profile_business
CREATE POLICY "Users can view own profile_business"
  ON public.profile_business FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view profile_business for discovery"
  ON public.profile_business FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile_business"
  ON public.profile_business FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile_business"
  ON public.profile_business FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile_business"
  ON public.profile_business FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- profile_media
CREATE POLICY "Users can view own profile_media"
  ON public.profile_media FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view profile_media for discovery"
  ON public.profile_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile_media"
  ON public.profile_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile_media"
  ON public.profile_media FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile_media"
  ON public.profile_media FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- profile_account (owner + admin only; no broad authenticated SELECT)
CREATE POLICY "Users can view own profile_account"
  ON public.profile_account FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile_account"
  ON public.profile_account FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile_account"
  ON public.profile_account FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profile_account"
  ON public.profile_account FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- service_role full access (edge functions)
CREATE POLICY "Service role full access profile_core"
  ON public.profile_core FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access profile_creative"
  ON public.profile_creative FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access profile_business"
  ON public.profile_business FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access profile_media"
  ON public.profile_media FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access profile_account"
  ON public.profile_account FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
