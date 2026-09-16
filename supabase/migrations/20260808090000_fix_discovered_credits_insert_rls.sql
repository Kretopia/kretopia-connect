-- Security fix: discovered_credits' INSERT policy was named "Service role
-- can insert discovered credits" but had WITH CHECK (true) and no `TO`
-- restriction — meaning any authenticated (or anon) client could insert a
-- discovered_credits row for ANY user_id, not just their own. The real
-- AI-discovery path (enrich-creator-profile edge function) uses the
-- service-role key, which bypasses RLS entirely regardless of this policy,
-- so tightening it to "own rows only" doesn't affect that flow — it only
-- closes the gap for direct client calls.
DROP POLICY IF EXISTS "Service role can insert discovered credits" ON public.discovered_credits;

CREATE POLICY "Users insert their own discovered credits"
  ON public.discovered_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);
