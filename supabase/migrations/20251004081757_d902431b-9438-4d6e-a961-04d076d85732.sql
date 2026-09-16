-- Fix security definer view by enabling security invoker mode
-- This ensures the view respects RLS policies of the querying user
DROP VIEW IF EXISTS public.analytics_funnel;

CREATE OR REPLACE VIEW public.analytics_funnel
WITH (security_invoker=on)
AS
SELECT 
  event_name,
  event_category,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(*) as total_events,
  DATE_TRUNC('day', created_at) as event_date
FROM public.analytics_events
GROUP BY event_name, event_category, DATE_TRUNC('day', created_at)
ORDER BY event_date DESC, total_events DESC;