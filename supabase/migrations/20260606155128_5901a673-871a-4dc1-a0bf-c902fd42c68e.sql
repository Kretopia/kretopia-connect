
-- 1) Storage: remove broad public-read policies
DROP POLICY IF EXISTS "Board assets are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public read outreach media" ON storage.objects;

-- 2) jam_participants: remove anon read (guest emails exposed). Authenticated policy still serves public-event browsing.
DROP POLICY IF EXISTS "Public event participants visible to everyone" ON public.jam_participants;

-- 3) discovered_credits: lock down insert to service_role only
DROP POLICY IF EXISTS "Service role can insert discovered credits" ON public.discovered_credits;
CREATE POLICY "Service role can insert discovered credits"
  ON public.discovered_credits
  FOR INSERT
  TO service_role
  WITH CHECK (true);
