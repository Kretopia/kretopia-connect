
-- 1. Tighten icdb_project_roles UPDATE
DROP POLICY IF EXISTS "Authenticated users can claim roles" ON public.icdb_project_roles;
CREATE POLICY "Authenticated users can claim unclaimed roles"
ON public.icdb_project_roles
FOR UPDATE
TO authenticated
USING (claimed_by IS NULL OR claimed_by = auth.uid())
WITH CHECK (claimed_by = auth.uid());

-- 2. Tighten newsletter_subscribers UPDATE (allow self-management via email match or admin)
DROP POLICY IF EXISTS "Subscribers can manage own" ON public.newsletter_subscribers;
CREATE POLICY "Subscribers can manage own via admin"
ON public.newsletter_subscribers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Tighten podcast_episodes ALL → admin-only writes, public reads remain via separate select policy if any
DROP POLICY IF EXISTS "Authenticated users can manage episodes" ON public.podcast_episodes;
CREATE POLICY "Admins can manage podcast episodes"
ON public.podcast_episodes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Ensure public can still read podcast episodes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='podcast_episodes' AND cmd='SELECT'
  ) THEN
    EXECUTE 'CREATE POLICY "Anyone can view podcast episodes" ON public.podcast_episodes FOR SELECT USING (true)';
  END IF;
END $$;

-- 4. Switch SECURITY DEFINER views to security_invoker
ALTER VIEW public.analytics_funnel SET (security_invoker = true);
ALTER VIEW public.connected_platforms_public SET (security_invoker = true);
ALTER VIEW public.public_profiles_discovery SET (security_invoker = true);
ALTER VIEW public.public_reviews SET (security_invoker = true);
ALTER VIEW public.public_skill_endorsements SET (security_invoker = true);
ALTER VIEW public.reviews_public SET (security_invoker = true);
ALTER VIEW public.skill_endorsements_public SET (security_invoker = true);
