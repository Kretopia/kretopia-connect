-- Fix security definer views by recreating them with security_invoker option

-- Drop and recreate conversation_list view with security_invoker
DROP VIEW IF EXISTS public.conversation_list;

CREATE OR REPLACE VIEW public.conversation_list
WITH (security_invoker=true)
AS
SELECT DISTINCT ON (
  CASE
    WHEN m.sender_id < m.receiver_id THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END
)
  CASE
    WHEN m.sender_id < m.receiver_id THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END AS conversation_id,
  m.id AS message_id,
  m.sender_id,
  m.receiver_id,
  m.content,
  m.created_at,
  m.read,
  m.match_id,
  sender.full_name AS sender_name,
  sender.avatar_url AS sender_avatar,
  receiver.full_name AS receiver_name,
  receiver.avatar_url AS receiver_avatar
FROM messages m
JOIN profiles sender ON sender.user_id = m.sender_id
JOIN profiles receiver ON receiver.user_id = m.receiver_id
ORDER BY
  CASE
    WHEN m.sender_id < m.receiver_id THEN m.sender_id || '_' || m.receiver_id
    ELSE m.receiver_id || '_' || m.sender_id
  END,
  m.created_at DESC;

-- Drop and recreate user_applications_view with security_invoker
DROP VIEW IF EXISTS public.user_applications_view;

CREATE OR REPLACE VIEW public.user_applications_view
WITH (security_invoker=true)
AS
SELECT 
  a.id,
  a.opportunity_id,
  a.applicant_id,
  a.cover_letter,
  a.portfolio_links,
  a.status,
  a.created_at,
  a.updated_at,
  a.application_notes,
  a.expected_rate,
  a.availability,
  o.title AS opportunity_title,
  o.type AS opportunity_type,
  o.compensation,
  o.location,
  o.created_by AS poster_id,
  p.full_name AS poster_name,
  p.avatar_url AS poster_avatar
FROM applications a
JOIN opportunities o ON a.opportunity_id = o.id
LEFT JOIN profiles p ON o.created_by = p.user_id;

-- Grant appropriate permissions
GRANT SELECT ON public.conversation_list TO authenticated;
GRANT SELECT ON public.user_applications_view TO authenticated;