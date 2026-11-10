DROP POLICY IF EXISTS "authenticated read config" ON public.ai_credit_config;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_credit_config FROM anon, authenticated;
GRANT ALL ON public.ai_credit_config TO service_role;