#!/usr/bin/env bash
# Sanitized production → staging export
#
# WHAT THIS DOES
#   Exports "safe" tables from Lovable Cloud to CSVs under
#   /mnt/documents/staging-export/ with PII stripped and user ids hashed.
#
# HASHING
#   Every user id becomes md5(user_id || $SALT)::uuid — stable within the
#   export so foreign keys still join, one-way, unlinkable to prod.
#
# NEVER EXPORTED (skipped entirely)
#   - All message/DM/chat/transcript tables
#   - All auth / oauth / token / push-subscription tables
#   - All money tables (invoices, expenses, wallets, bank accounts,
#     stripe_webhook_events, wallet_transfers, event_orders, purchases, pledges…)
#   - Support / verification / moderation / user_reports / dispute tables
#   - Raw analytics with IPs / user agents
#
# USAGE
#   SALT=$(openssl rand -hex 16) bash scripts/sanitized-export.sh

set -euo pipefail
: "${SALT:?Set SALT env var, e.g. SALT=\$(openssl rand -hex 16)}"

OUT="/mnt/documents/staging-export"
mkdir -p "$OUT"
echo "→ exporting to $OUT"

H() { echo "md5(coalesce($1::text,'') || '$SALT')::uuid"; }

dump() {
  local file="$1"; shift
  local sql="$*"
  echo "  · $file"
  psql -v ON_ERROR_STOP=1 -c "COPY ($sql) TO STDOUT WITH CSV HEADER" > "$OUT/$file"
}

############################
# profiles — heaviest scrub
############################
dump profiles.csv "
SELECT
  id,
  $(H user_id)                                              AS user_id,
  'Creator ' || left(md5(user_id::text || '$SALT'), 6)      AS full_name,
  role, bio, industry, job_title, subscription_tier, account_type,
  company_name, company_size, company_industry, company_tagline,
  professional_skills, passion_skills, sub_roles, model_categories,
  primary_intent, primary_intents, collab_intent, rate_range,
  hourly_rate, project_rate, rate_currency, preferred_currency,
  availability_status, availability_note, available_from,
  xp, level, total_xp, current_streak, longest_streak, streak_count,
  daily_swipes, project_credits, storage_used_bytes, storage_limit_bytes,
  verification_status, verification_score, verification_tier,
  portfolio_verified, social_verified, email_verified, phone_verified,
  id_verified, payment_verified, spotify_verified, youtube_verified,
  instagram_verified, imdb_verified, discogs_verified,
  achievement_badges, badge, profile_frame,
  onboarding_completed, onboarding_step, tour_completed,
  is_claimed, claimed_at, profile_source,
  ui_vibe, location_precision, location_visible,
  average_rating, total_reviews, credit_score, passport_profession,
  bookings_enabled, is_manager_mode, is_hidden_backer,
  (ambassador_code IS NOT NULL)                              AS has_ambassador_code,
  created_at, updated_at, last_active_date, verified_at,
  -- scrubbed
  NULL::text  AS location,
  NULL::float AS latitude,
  NULL::float AS longitude,
  NULL::text  AS company_address,
  NULL::text  AS avatar_url,
  NULL::text  AS cover_image_url,
  NULL::text  AS company_logo_url,
  NULL::text  AS phone_number,
  NULL::text  AS date_of_birth,
  NULL::text  AS website,
  NULL::text  AS calendly_url,
  NULL::text  AS stripe_customer_id,
  NULL::text  AS stripe_account_id,
  NULL::text  AS username,
  NULL::jsonb AS social_links
FROM public.profiles"

############################
# credits (IMDb-style)
############################
dump credits.csv "
SELECT
  id,
  $(H user_id) AS user_id,
  project_name, role, year, platform,
  verification_status, is_featured, credit_category, project_type,
  start_date, end_date, media_type,
  endorsement_count, view_count, ai_confidence,
  ARRAY(SELECT $(H u) FROM unnest(collaborator_user_ids) u) AS collaborator_user_ids,
  created_at, updated_at
FROM public.credits"

############################
# projects / studios
############################
dump projects.csv "
SELECT
  id,
  $(H created_by)    AS created_by,
  $(H client_user_id) AS client_user_id,
  $(H agent_user_id)  AS agent_user_id,
  title, description, status, workspace_type, deal_type,
  pinned_stage, mood, currency, margin_type,
  setup_completed, track_as_credit, recap_published,
  created_at, updated_at
FROM public.projects"

dump project_collaborators.csv "
SELECT
  id, project_id,
  $(H user_id)    AS user_id,
  $(H invited_by) AS invited_by,
  role, status, agent_role, invited_at, accepted_at, created_at, updated_at
FROM public.project_collaborators"

dump project_tasks.csv "
SELECT
  id, project_id, title, status, priority, due_date, labels,
  $(H assigned_to) AS assigned_to,
  $(H created_by)  AS created_by,
  created_at, updated_at
FROM public.project_tasks"

dump project_deliverables.csv "
SELECT
  id, project_id, title, status, kind, media_type, version,
  $(H assignee_id)  AS assignee_id,
  $(H submitted_by) AS submitted_by,
  $(H reviewed_by)  AS reviewed_by,
  due_date, reviewed_at, sort_order, source, created_at, updated_at
FROM public.project_deliverables"

############################
# opportunities / gigs / scout
############################
dump opportunities.csv "
SELECT
  id,
  $(H created_by)         AS created_by,
  $(H posted_by_manager_id) AS posted_by_manager_id,
  $(H scouted_by)         AS scouted_by,
  title, description, type, compensation,
  location_city, location_country, tags, status,
  requirements, skills, deliverables, duration,
  view_count, is_priority, priority_expires_at,
  application_deadline, source_platform,
  usage_type, usage_exclusive,
  casting_gender, casting_age_min, casting_age_max, casting_categories,
  created_at, updated_at
FROM public.opportunities"

dump scouted_gigs.csv "
SELECT
  id,
  $(H target_user_id) AS target_user_id,
  source, source_name, source_url, title, company, location, remote,
  description, compensation, deadline, apply_url, skills, tags,
  fit_score, fit_reason, posted_at, scouted_at, expires_at, dedupe_key
FROM public.scouted_gigs"

dump scouted_gig_actions.csv "
SELECT
  id, scouted_gig_id, action, outcome,
  $(H user_id) AS user_id,
  created_at
FROM public.scouted_gig_actions"

dump applications.csv "
SELECT
  id, opportunity_id,
  $(H applicant_id) AS applicant_id,
  status, expected_rate, availability, created_at, updated_at
FROM public.applications"

############################
# graph: connections / matches / swipes
############################
dump connections.csv "
SELECT
  id,
  $(H user_id)           AS user_id,
  $(H connected_user_id) AS connected_user_id,
  status, context, is_message_request,
  created_at, declined_at
FROM public.connections"

dump matches.csv "
SELECT
  id,
  $(H user1_id) AS user1_id,
  $(H user2_id) AS user2_id,
  $(H target_id) AS target_id,
  match_type, status, created_at
FROM public.matches"

dump swipes.csv "
SELECT
  id,
  $(H user_id)   AS user_id,
  $(H target_id) AS target_id,
  target_type, direction, is_super_like, is_undo, created_at
FROM public.swipes"

############################
# aggregate / lookup (little or no PII)
############################
dump user_roles.csv "SELECT id, $(H user_id) AS user_id, role FROM public.user_roles"
dump daily_streaks.csv "
SELECT id, $(H user_id) AS user_id, streak_type, current_streak, longest_streak,
       last_action_date, total_actions, created_at, updated_at
FROM public.daily_streaks"
dump founding_member_quests.csv "
SELECT id, $(H user_id) AS user_id, quest_key, completed, completed_at, created_at, updated_at
FROM public.founding_member_quests"

dump industry_stats.csv       "SELECT * FROM public.industry_stats"
dump icdb_role_taxonomy.csv   "SELECT * FROM public.icdb_role_taxonomy"
dump location_categories.csv  "SELECT * FROM public.location_categories"
dump email_templates.csv "SELECT id, name, subject, created_at, updated_at FROM public.email_templates"

echo
echo "✅ done"
ls -lh "$OUT"
