/**
 * Explicit column list for `profiles` reads from the client.
 *
 * Sensitive columns (phone_number, phone_otp, phone_otp_expires_at,
 * stripe_customer_id, stripe_subscription_id, stripe_account_id) are NOT
 * granted to the anon/authenticated roles at the database level, so
 * `select("*")` would fail. Use this constant instead.
 *
 * The account owner can read their own payment identifiers through the
 * `get_own_payment_identifiers` RPC.
 */
export const PROFILE_SELECT = [
  "id", "user_id", "full_name", "role", "bio", "location", "avatar_url",
  "project_credits", "created_at", "updated_at", "website", "linkedin_url",
  "behance_url", "imdb_url", "instagram_url", "twitter_url", "spotify_url",
  "soundcloud_url", "youtube_subscribers", "instagram_followers",
  "tiktok_followers", "spotify_listeners", "twitter_followers",
  "linkedin_connections", "total_engagement_rate", "avg_views",
  "verified_metrics", "xp", "level", "subscription_tier", "daily_swipes",
  "last_swipe_reset", "subscription_product_id", "subscription_status",
  "subscription_end_date", "storage_used_bytes", "storage_limit_bytes",
  "available_invites", "invite_code_used", "badge", "job_title", "industry",
  "professional_skills", "passion_skills", "review_share_token", "press_links",
  "awards", "section_order", "membership_number", "stripe_account_status",
  "og_promotion_used", "og_promotion_expires_at", "streak_count",
  "last_active_date", "streak_freeze_count", "longest_streak", "youtube_url",
  "tiktok_url", "onboarding_completed", "account_type", "company_name",
  "company_logo_url", "company_about", "company_location_lat",
  "company_location_lng", "company_address", "google_maps_place_id",
  "company_size", "company_industry", "partner_location_id", "average_rating",
  "total_reviews", "company_images", "onboarding_step", "onboarding_started_at",
  "onboarding_reminder_sent", "verification_status", "verification_score",
  "verification_notes", "verified_at", "portfolio_verified", "social_verified",
  "collab_intent", "rate_range", "invited_by", "verified_credentials",
  "verification_tier", "achievement_badges", "verification_breakdown",
  "calendly_url", "spotify_verified", "youtube_verified", "instagram_verified",
  "imdb_verified", "discogs_verified", "is_claimed", "claimed_at", "claimed_by",
  "profile_source", "claim_token", "imported_data", "imported_from_url",
  "latitude", "longitude", "location_updated_at", "location_visible",
  "location_precision", "tour_completed", "cover_image_url", "company_tagline",
  "team_member_ids", "profile_frame", "email_verified", "phone_verified",
  "id_verified", "id_verified_at", "payment_verified", "preferred_currency",
  "hourly_rate", "project_rate", "rate_currency", "avg_response_hours",
  "video_intro_url", "availability_status", "availability_note",
  "available_from", "is_manager_mode", "credit_score", "boost_expires_at",
  "double_xp_expires_at", "partner_code_used", "current_streak",
  "last_checkin_date", "total_xp", "icdb_creator_id", "site_enabled",
  "site_template", "site_sections", "site_headline", "site_bio", "username",
  "site_custom_blocks", "sub_roles", "vimeo_url", "is_hidden_backer",
  "date_of_birth", "age_verified", "day2_engagement_sent_at",
  "day5_engagement_sent_at", "primary_intent", "intent_set_at",
  "intent_week_start", "primary_intents", "last_universe_scan_at",
  "social_links", "ambassador_code", "referred_by_ambassador",
  "identity_face_verified", "identity_face_verified_at", "ui_vibe",
  "model_stats", "model_unions", "mother_agency", "mother_agency_verified",
  "agency_representation", "model_categories", "polaroids", "comp_card_layout",
  "passport_profession", "bookings_enabled",
].join(", ") as unknown as "*";
// Cast to "*" purely for type inference: at runtime we send the explicit
// safe column list, but the row shape is identical minus the ungranted
// sensitive columns.
