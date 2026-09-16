-- Fix user_applications_view to include location field
DROP VIEW IF EXISTS public.user_applications_view CASCADE;
CREATE VIEW public.user_applications_view
WITH (security_invoker = true)
AS
SELECT 
  a.*,
  o.title as opportunity_title,
  o.type as opportunity_type,
  o.compensation,
  o.location,
  o.status as opportunity_status,
  p.full_name as applicant_name,
  p.avatar_url as applicant_avatar
FROM public.applications a
LEFT JOIN public.opportunities o ON o.id = a.opportunity_id
LEFT JOIN public.profiles p ON p.user_id = a.applicant_id;