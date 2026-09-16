-- Fix remaining security definer views by explicitly setting security_invoker

-- Fix analytics_funnel view
DROP VIEW IF EXISTS public.analytics_funnel CASCADE;
CREATE VIEW public.analytics_funnel
WITH (security_invoker = true)
AS
SELECT 
  date_trunc('day', created_at) as event_date,
  event_name,
  event_category,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT session_id) as unique_sessions
FROM public.analytics_events
GROUP BY date_trunc('day', created_at), event_name, event_category;

-- Fix user_applications_view if it exists
DROP VIEW IF EXISTS public.user_applications_view CASCADE;
CREATE VIEW public.user_applications_view
WITH (security_invoker = true)
AS
SELECT 
  a.*,
  o.title as opportunity_title,
  o.type as opportunity_type,
  o.compensation,
  o.status as opportunity_status,
  p.full_name as applicant_name,
  p.avatar_url as applicant_avatar
FROM public.applications a
LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
LEFT JOIN public.profiles p ON p.user_id = a.applicant_id;