-- Fix SECURITY DEFINER view warnings by setting views to SECURITY INVOKER
-- This ensures RLS policies of the querying user are enforced

ALTER VIEW skill_endorsements_public SET (security_invoker = on);
ALTER VIEW public_reviews SET (security_invoker = on);