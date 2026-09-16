// Explicit column list for public/authenticated reads of `opportunities`.
// Excludes guest_email, guest_company_name, guest_logo_url, guest_profile_id,
// and verification_token — see migration
// 20260905110000_lock_opportunities_guest_contact_columns.sql. A bare
// select('*') now fails with "permission denied for column" for anon and
// authenticated roles, since those columns no longer carry a blanket grant.
export const OPPORTUNITY_PUBLIC_COLUMNS =
  "id, title, type, description, compensation, location, location_city, location_country, latitude, longitude, requirements, skills, deliverables, duration, tags, status, image_url, created_at, updated_at, created_by, scouted_by, posted_by_manager_id, claim_status, claim_token, source_platform, original_source_text, barter_offering, barter_requesting, barter_gifted_value_usd, barter_posting_deadline, platform_requirements, min_followers, content_deliverables, usage_type, usage_territory, usage_duration, usage_exclusive, whitelisting_allowed, application_deadline, casting_age_max, casting_age_min, casting_categories, casting_fitting_date, casting_gender, casting_max_height_cm, casting_min_height_cm, casting_shoot_date, casting_usage_summary, is_guest_post, is_priority, priority_expires_at, verified_at, view_count";
