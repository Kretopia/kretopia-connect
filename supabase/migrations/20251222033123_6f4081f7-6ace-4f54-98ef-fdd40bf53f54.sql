-- Fix SECURITY DEFINER warnings by setting views to SECURITY INVOKER
-- This ensures RLS policies are applied based on the querying user, not the view creator

ALTER VIEW public.public_profiles_safe SET (security_invoker = on);
ALTER VIEW public.skill_endorsements_public SET (security_invoker = on);