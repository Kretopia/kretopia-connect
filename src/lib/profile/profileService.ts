import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { PROFILE_SELECT } from "@/lib/profile/profileColumns";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileUpdate = Partial<Omit<Profile, "id" | "user_id">>;

type SplitTable =
  | "profile_core"
  | "profile_creative"
  | "profile_business"
  | "profile_media"
  | "profile_account";

/** Until types.ts is regenerated after migration, query split tables via cast. */
function fromSplit(table: SplitTable) {
  return supabase.from(table as "profiles");
}

const CHILD_META_KEYS = ["id", "profile_id", "user_id", "created_at", "updated_at"] as const;

const CORE_KEYS = [
  "full_name",
  "username",
  "bio",
  "avatar_url",
  "cover_image_url",
  "role",
  "sub_roles",
  "job_title",
  "account_type",
  "location",
  "latitude",
  "longitude",
  "location_precision",
  "location_updated_at",
  "location_visible",
  "date_of_birth",
  "age_verified",
  "phone_number",
  "phone_verified",
  "phone_otp",
  "phone_otp_expires_at",
  "email_verified",
  "onboarding_completed",
  "onboarding_step",
  "onboarding_started_at",
  "onboarding_reminder_sent",
  "tour_completed",
  "is_claimed",
  "claim_token",
  "claimed_at",
  "claimed_by",
  "is_manager_mode",
  "is_hidden_backer",
  "ui_vibe",
  "profile_frame",
  "profile_source",
  "imported_data",
  "imported_from_url",
  "membership_number",
  "preferred_currency",
] as const satisfies readonly (keyof Profile)[];

const CREATIVE_KEYS = [
  "passport_profession",
  "professional_skills",
  "passion_skills",
  "industry",
  "hourly_rate",
  "project_rate",
  "rate_range",
  "rate_currency",
  "credit_score",
  "project_credits",
  "portfolio_verified",
  "polaroids",
  "comp_card_layout",
  "section_order",
  "awards",
  "video_intro_url",
  "model_categories",
  "model_stats",
  "model_unions",
  "mother_agency",
  "mother_agency_verified",
  "agency_representation",
  "icdb_creator_id",
  "site_enabled",
  "site_headline",
  "site_bio",
  "site_sections",
  "site_template",
  "site_custom_blocks",
  "availability_status",
  "availability_note",
  "available_from",
  "bookings_enabled",
  "calendly_url",
  "collab_intent",
  "primary_intent",
  "primary_intents",
  "intent_set_at",
  "intent_week_start",
] as const satisfies readonly (keyof Profile)[];

const BUSINESS_KEYS = [
  "company_name",
  "company_tagline",
  "company_about",
  "company_address",
  "company_industry",
  "company_size",
  "company_logo_url",
  "company_images",
  "company_location_lat",
  "company_location_lng",
  "website",
  "google_maps_place_id",
  "team_member_ids",
  "partner_code_used",
  "partner_location_id",
  "invite_code_used",
  "invited_by",
  "available_invites",
] as const satisfies readonly (keyof Profile)[];

const MEDIA_KEYS = [
  "social_links",
  "press_links",
  "behance_url",
  "imdb_url",
  "instagram_url",
  "linkedin_url",
  "soundcloud_url",
  "spotify_url",
  "tiktok_url",
  "twitter_url",
  "vimeo_url",
  "youtube_url",
  "instagram_followers",
  "linkedin_connections",
  "spotify_listeners",
  "tiktok_followers",
  "twitter_followers",
  "youtube_subscribers",
  "avg_views",
  "total_engagement_rate",
  "instagram_verified",
  "discogs_verified",
  "imdb_verified",
  "spotify_verified",
  "youtube_verified",
  "social_verified",
  "verified_metrics",
  "last_universe_scan_at",
] as const satisfies readonly (keyof Profile)[];

const ACCOUNT_KEYS = [
  "subscription_tier",
  "subscription_status",
  "subscription_end_date",
  "subscription_product_id",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_account_id",
  "stripe_account_status",
  "payment_verified",
  "storage_limit_bytes",
  "storage_used_bytes",
  "xp",
  "level",
  "total_xp",
  "badge",
  "achievement_badges",
  "streak_count",
  "current_streak",
  "longest_streak",
  "last_checkin_date",
  "last_active_date",
  "streak_freeze_count",
  "daily_swipes",
  "last_swipe_reset",
  "boost_expires_at",
  "double_xp_expires_at",
  "og_promotion_expires_at",
  "og_promotion_used",
  "average_rating",
  "total_reviews",
  "avg_response_hours",
  "verification_status",
  "verification_tier",
  "verification_score",
  "verification_breakdown",
  "verification_notes",
  "verified_at",
  "verified_credentials",
  "id_verified",
  "id_verified_at",
  "identity_face_verified",
  "identity_face_verified_at",
  "ambassador_code",
  "referred_by_ambassador",
  "day2_engagement_sent_at",
  "day5_engagement_sent_at",
  "review_share_token",
] as const satisfies readonly (keyof Profile)[];

function omitChildMeta<T extends Record<string, unknown>>(row: T | null): Partial<Profile> {
  if (!row) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!(CHILD_META_KEYS as readonly string[]).includes(key)) {
      out[key] = value;
    }
  }
  return out as Partial<Profile>;
}

function pickFields(data: ProfileUpdate, keys: readonly (keyof Profile)[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in data && data[key as keyof ProfileUpdate] !== undefined) {
      out[key as string] = data[key as keyof ProfileUpdate];
    }
  }
  return out;
}

function mergeSplitRows(
  core: Record<string, unknown> | null,
  creative: Record<string, unknown> | null,
  business: Record<string, unknown> | null,
  media: Record<string, unknown> | null,
  account: Record<string, unknown> | null,
): Profile | null {
  if (!core?.profile_id || !core?.user_id) return null;

  const merged: Profile = {
    ...(omitChildMeta(creative) as Profile),
    ...(omitChildMeta(business) as Profile),
    ...(omitChildMeta(media) as Profile),
    ...(omitChildMeta(account) as Profile),
    ...(omitChildMeta(core) as Profile),
    id: core.profile_id as string,
    user_id: core.user_id as string,
    created_at: (core.created_at as string | null) ?? null,
    updated_at: (core.updated_at as string | null) ?? null,
  };

  return merged;
}

async function getLegacyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveProfileAnchor(userId: string): Promise<{ id: string; user_id: string } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Load a complete profile by joining normalized split tables.
 * Falls back to legacy `profiles` row when split rows are not backfilled yet.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  // Split tables (profile_core/*) are not present in this environment.
  // Read directly from the legacy `profiles` table. If split tables are
  // reintroduced later, restore the merge path here.
  return getLegacyProfile(userId);
}

async function upsertSplitRow(
  table: SplitTable,
  userId: string,
  profileId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(payload).length === 0) return;

  const { data: existing } = await fromSplit(table)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await fromSplit(table).update(payload).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await fromSplit(table).insert({
    profile_id: profileId,
    user_id: userId,
    ...payload,
  } as never);

  if (error) throw error;
}

/**
 * Update profile fields across split tables (and legacy `profiles` for dual-write during migration).
 * Returns the merged profile in legacy `profiles` shape.
 */
export async function updateProfile(userId: string, data: ProfileUpdate): Promise<Profile | null> {
  if (Object.keys(data).length === 0) {
    return getProfile(userId);
  }

  const anchor = await resolveProfileAnchor(userId);
  if (!anchor) {
    throw new Error(`Profile anchor not found for user_id ${userId}`);
  }

  const corePayload = pickFields(data, CORE_KEYS);
  const creativePayload = pickFields(data, CREATIVE_KEYS);
  const businessPayload = pickFields(data, BUSINESS_KEYS);
  const mediaPayload = pickFields(data, MEDIA_KEYS);
  const accountPayload = pickFields(data, ACCOUNT_KEYS);

  const legacyPayload = { ...data };

  const legacyResult = await supabase.from("profiles").update(legacyPayload).eq("user_id", userId);

  if (legacyResult.error) throw legacyResult.error;

  return getProfile(userId);
}
