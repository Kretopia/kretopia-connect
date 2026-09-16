-- Warning flagged by the deep security scan: "Analytics and error logs can
-- be spoofed to impersonate other users."
--
-- "INSERT policies on 'analytics_events', 'event_analytics_events',
-- 'site_analytics', and 'client_error_logs' allow any anonymous/
-- authenticated caller to write rows with an arbitrary user_id (no WITH
-- CHECK tying user_id to auth.uid()). This allows spoofed analytics/error
-- data to be attributed to any user, and unrestricted log injection."
--
-- All four tables intentionally allow anonymous inserts (logged-out visitor
-- tracking, client-side error capture before auth loads), so the fix isn't
-- to require auth — it's to stop a caller from attaching someone else's
-- user_id to their own event. Require user_id to either be absent/null
-- (anonymous event) or match the caller's own auth.uid().
--
-- site_analytics is the one exception: confirmed via src/hooks/
-- useSiteAnalytics.ts that user_id there means "whose creator site this
-- view/click happened on", not "who performed it" — an anonymous visitor
-- browsing someone else's public site legitimately writes rows with that
-- site owner's user_id, which is not auth.uid(). Requiring user_id =
-- auth.uid() would break real-view tracking entirely. What the finding
-- actually named ("unrestricted log injection") is closed instead by
-- requiring the target user_id resolve to a real profile, which blocks
-- pure garbage/nonexistent-id flooding while preserving third-party view
-- tracking.

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can insert analytics" ON public.site_analytics;
CREATE POLICY "Anyone can insert analytics"
ON public.site_analytics FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = site_analytics.user_id));

DROP POLICY IF EXISTS "Anyone can log errors" ON public.client_error_logs;
CREATE POLICY "Anyone can log errors"
ON public.client_error_logs
FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can log analytics events" ON public.event_analytics_events;
CREATE POLICY "Anyone can log analytics events"
  ON public.event_analytics_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
