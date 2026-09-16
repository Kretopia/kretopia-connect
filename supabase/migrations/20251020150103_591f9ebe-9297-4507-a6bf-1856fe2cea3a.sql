-- Fix security definer view issue
-- Update public_profiles view to use SECURITY INVOKER to respect RLS
ALTER VIEW public_profiles SET (security_invoker = on);