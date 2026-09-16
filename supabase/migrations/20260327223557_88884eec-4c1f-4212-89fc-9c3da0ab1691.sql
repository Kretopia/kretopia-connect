
DROP VIEW IF EXISTS public.oauth_apps_public;
CREATE VIEW public.oauth_apps_public
WITH (security_invoker = true)
AS
SELECT id, client_id, name, description, redirect_uris, logo_url, is_active, created_at, owner_id
FROM oauth_apps
WHERE is_active = true;
