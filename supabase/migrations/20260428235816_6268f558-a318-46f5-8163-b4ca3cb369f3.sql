-- Extend site_analytics for platform-wide bounce/session tracking
ALTER TABLE public.site_analytics
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'creator_site';

CREATE INDEX IF NOT EXISTS idx_site_analytics_scope_created
  ON public.site_analytics (scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_session
  ON public.site_analytics (session_id);

-- Admin-only read policy for platform-scope rows (creator-site policy already exists)
DROP POLICY IF EXISTS "Admins can view platform analytics" ON public.site_analytics;
CREATE POLICY "Admins can view platform analytics"
  ON public.site_analytics
  FOR SELECT
  TO authenticated
  USING (scope = 'platform' AND public.has_role(auth.uid(), 'admin'));