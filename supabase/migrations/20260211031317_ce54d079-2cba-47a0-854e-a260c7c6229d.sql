
-- Fix 1: Replace overly permissive oauth_codes and oauth_tokens policies
-- Instead of FOR ALL USING(true), split into specific operations

-- oauth_codes: Drop the permissive policy
DROP POLICY IF EXISTS "Service role manages oauth codes" ON public.oauth_codes;

-- oauth_codes: Users can view their own codes
CREATE POLICY "Users can view own oauth codes"
ON public.oauth_codes FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- oauth_codes: No direct insert/update/delete by regular users
-- Edge functions use service_role key which bypasses RLS entirely,
-- so no explicit policy needed for service role operations.

-- oauth_tokens: Drop the permissive policy
DROP POLICY IF EXISTS "Service role manages oauth tokens" ON public.oauth_tokens;

-- oauth_tokens: Users can view their own tokens
CREATE POLICY "Users can view own oauth tokens"
ON public.oauth_tokens FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- oauth_tokens: Users can revoke their own tokens
CREATE POLICY "Users can revoke own oauth tokens"
ON public.oauth_tokens FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Fix 2: Restrict partner-logos uploads to authenticated users only
DROP POLICY IF EXISTS "Anyone can upload partner logos" ON storage.objects;

CREATE POLICY "Authenticated users can upload partner logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'partner-logos');
