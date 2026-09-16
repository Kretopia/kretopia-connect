-- Fix remaining security issues

-- 1. Fix analytics_funnel view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.analytics_funnel CASCADE;
CREATE VIEW public.analytics_funnel
WITH (security_invoker=on)
AS
SELECT 
  event_category,
  event_name,
  DATE_TRUNC('day', created_at) as event_date,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_events
FROM public.analytics_events
GROUP BY event_category, event_name, DATE_TRUNC('day', created_at);

-- 2. Fix conversation_list view to use SECURITY INVOKER
DROP VIEW IF EXISTS public.conversation_list CASCADE;
CREATE VIEW public.conversation_list
WITH (security_invoker=on)
AS
SELECT DISTINCT ON (conversation_id)
  CASE 
    WHEN m.sender_id < m.receiver_id 
    THEN m.sender_id || '-' || m.receiver_id
    ELSE m.receiver_id || '-' || m.sender_id
  END as conversation_id,
  m.id as message_id,
  m.sender_id,
  m.receiver_id,
  m.content,
  m.created_at,
  m.read,
  m.match_id,
  sender_profile.full_name as sender_name,
  sender_profile.avatar_url as sender_avatar,
  receiver_profile.full_name as receiver_name,
  receiver_profile.avatar_url as receiver_avatar
FROM public.messages m
LEFT JOIN public.profiles sender_profile ON sender_profile.user_id = m.sender_id
LEFT JOIN public.profiles receiver_profile ON receiver_profile.user_id = m.receiver_id
ORDER BY 
  conversation_id,
  m.created_at DESC;

-- 3. Check for any other views and update them
DO $$
DECLARE
  view_record RECORD;
BEGIN
  FOR view_record IN 
    SELECT schemaname, viewname 
    FROM pg_views 
    WHERE schemaname = 'public'
    AND viewname NOT IN ('analytics_funnel', 'conversation_list')
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker=on)', 
                   view_record.schemaname, 
                   view_record.viewname);
  END LOOP;
END $$;