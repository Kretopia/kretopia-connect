
-- Fix: OAuth app client secrets exposed via permissive RLS policy
-- Drop the overly permissive policy that exposes client_secret to everyone
DROP POLICY IF EXISTS "Anyone can read active oauth apps" ON public.oauth_apps;

-- Create a secure public view that excludes client_secret
CREATE OR REPLACE VIEW public.oauth_apps_public 
WITH (security_invoker = false)
AS
SELECT id, client_id, name, description, redirect_uris, logo_url, is_active, created_at, owner_id
FROM public.oauth_apps
WHERE is_active = true;

-- Grant read access on the safe view
GRANT SELECT ON public.oauth_apps_public TO authenticated, anon;

-- Restrict base table: only owners can read their own apps (service role bypasses RLS for edge functions)
CREATE POLICY "Owners can manage their oauth apps"
ON public.oauth_apps
FOR SELECT
USING (auth.uid() = owner_id);
