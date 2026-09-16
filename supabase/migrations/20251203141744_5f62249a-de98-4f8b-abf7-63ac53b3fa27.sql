
-- Fix remaining views without SECURITY INVOKER

-- Recreate public_skill_endorsements with SECURITY INVOKER
DROP VIEW IF EXISTS public_skill_endorsements;
CREATE VIEW public_skill_endorsements WITH (security_invoker = on) AS
SELECT id, profile_id, request_id, skill_name, endorser_name, endorser_company,
       project_name, proficiency_level, testimonial, relationship, created_at, verified
FROM skill_endorsements;

-- Recreate public_reviews with SECURITY INVOKER
DROP VIEW IF EXISTS public_reviews;
CREATE VIEW public_reviews WITH (security_invoker = on) AS
SELECT id, profile_id, reviewer_id, reviewer_name, reviewer_role, reviewer_company,
       reviewer_avatar_url, rating, review_text, project_name, collaboration_type,
       is_endorsed, is_verified, status, created_at, updated_at
FROM reviews
WHERE status = 'approved';

-- Recreate conversation_list with SECURITY INVOKER
DROP VIEW IF EXISTS conversation_list;
CREATE VIEW conversation_list WITH (security_invoker = on) AS
SELECT DISTINCT ON (
    CASE
        WHEN m.sender_id < m.receiver_id THEN (m.sender_id || '-' || m.receiver_id)
        ELSE (m.receiver_id || '-' || m.sender_id)
    END)
    CASE
        WHEN m.sender_id < m.receiver_id THEN (m.sender_id || '-' || m.receiver_id)
        ELSE (m.receiver_id || '-' || m.sender_id)
    END AS conversation_id,
    m.id AS message_id,
    m.sender_id,
    m.receiver_id,
    m.content,
    m.created_at,
    m.read,
    m.match_id,
    sender_profile.full_name AS sender_name,
    sender_profile.avatar_url AS sender_avatar,
    receiver_profile.full_name AS receiver_name,
    receiver_profile.avatar_url AS receiver_avatar
FROM messages m
LEFT JOIN profiles sender_profile ON sender_profile.user_id = m.sender_id
LEFT JOIN profiles receiver_profile ON receiver_profile.user_id = m.receiver_id
ORDER BY
    CASE
        WHEN m.sender_id < m.receiver_id THEN (m.sender_id || '-' || m.receiver_id)
        ELSE (m.receiver_id || '-' || m.sender_id)
    END, m.created_at DESC;

-- Recreate analytics_funnel with SECURITY INVOKER
DROP VIEW IF EXISTS analytics_funnel;
CREATE VIEW analytics_funnel WITH (security_invoker = on) AS
SELECT date_trunc('day', created_at) AS event_date,
       event_name, event_category,
       count(*) AS total_events,
       count(DISTINCT user_id) AS unique_users,
       count(DISTINCT session_id) AS unique_sessions
FROM analytics_events
GROUP BY date_trunc('day', created_at), event_name, event_category;

-- Recreate user_applications_view with SECURITY INVOKER
DROP VIEW IF EXISTS user_applications_view;
CREATE VIEW user_applications_view WITH (security_invoker = on) AS
SELECT a.id, a.opportunity_id, a.applicant_id, a.cover_letter, a.portfolio_links,
       a.status, a.created_at, a.updated_at, a.application_notes, a.expected_rate, a.availability,
       o.title AS opportunity_title, o.type AS opportunity_type, o.compensation, o.location,
       o.status AS opportunity_status,
       p.full_name AS applicant_name, p.avatar_url AS applicant_avatar
FROM applications a
LEFT JOIN opportunities o ON o.id = a.opportunity_id
LEFT JOIN profiles p ON p.user_id = a.applicant_id;

-- Recreate skill_endorsement_counts with SECURITY INVOKER
DROP VIEW IF EXISTS skill_endorsement_counts;
CREATE VIEW skill_endorsement_counts WITH (security_invoker = on) AS
SELECT profile_id, skill_name,
       count(*) AS endorsement_count,
       round(avg(CASE proficiency_level
           WHEN 'beginner' THEN 1
           WHEN 'intermediate' THEN 2
           WHEN 'advanced' THEN 3
           WHEN 'expert' THEN 4
           ELSE 0
       END)) AS average_level
FROM skill_endorsements
GROUP BY profile_id, skill_name;

-- Grant access to all views
GRANT SELECT ON public_skill_endorsements TO anon, authenticated;
GRANT SELECT ON public_reviews TO anon, authenticated;
GRANT SELECT ON conversation_list TO authenticated;
GRANT SELECT ON analytics_funnel TO authenticated;
GRANT SELECT ON user_applications_view TO authenticated;
GRANT SELECT ON skill_endorsement_counts TO anon, authenticated;
