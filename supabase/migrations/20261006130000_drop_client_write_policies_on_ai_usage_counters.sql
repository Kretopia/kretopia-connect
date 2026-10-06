-- Remove the client-side write policies on the daily AI usage counters.
--
-- WRITTEN FOR REVIEW. NOT APPLIED TO THE LIVE DATABASE. Per the standing rule
-- for this repo, row-level-security changes need explicit human approval before
-- they are applied (via the SQL editor of the backend the app really uses).
-- Merging this file does not apply it.
--
-- Problem (confirmed on production 2026-10-07 by a read-only catalog query,
-- pg_policies):
--   public.desk_ai_usage and public.studio_ai_usage still carry INSERT and UPDATE
--   policies for `authenticated` ("... WITH CHECK / USING (auth.uid() = user_id)").
--   They were added "just in case" (20260502231733, 20260819090000) next to the
--   atomic SECURITY DEFINER counters, and let a signed-in user write their OWN
--   counter row with any value, e.g.
--     PATCH /rest/v1/desk_ai_usage?user_id=eq.<self>&usage_date=eq.<today>
--           {"message_count": 0}
--   That resets the daily cap, so a free account can send unlimited Kreto /
--   DeskAI messages (desk_ai_usage is shared by thrive-ai-chat, desk-ai and
--   desk-agent) and unlimited Studio AI generations, each of which costs real
--   Gemini usage. 20260910180000 drops these four policies, but it is not
--   applied in production (also confirmed: its caller-identity check is absent).
--
-- Fix: drop exactly those four policies. RLS is enabled on both tables
-- (20260420211934, 20260819090000), so with no INSERT/UPDATE policy a client
-- write is denied by default. The SELECT policies ("Users can view their own ...")
-- are not touched, so a user can still read their own usage.
--
-- Why nothing legitimate breaks: every writer is the service role (the
-- consume_* / refund_* functions are SECURITY DEFINER and owned by the table
-- owner, and the edge functions that call them use SUPABASE_SERVICE_ROLE_KEY);
-- both bypass RLS. No code in src/ or supabase/functions reads or writes these
-- two tables directly on main (only the RPCs do).
--
-- Safe to run anywhere: a table that does not exist is skipped, DROP POLICY
-- IF EXISTS makes it idempotent, and no table, column, row, function or other
-- policy is touched.
--
-- Verify after applying (expect zero rows; the SELECT policies must remain):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename IN ('desk_ai_usage', 'studio_ai_usage')
--   ORDER BY tablename, policyname;
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE oid IN ('public.desk_ai_usage'::regclass, 'public.studio_ai_usage'::regclass);  -- both true
--
-- Roll back (restores the original, bypassable policies; not recommended):
--   CREATE POLICY "Users can insert their own DeskAI usage" ON public.desk_ai_usage
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "Users can update their own DeskAI usage" ON public.desk_ai_usage
--     FOR UPDATE TO authenticated USING (auth.uid() = user_id);
--   CREATE POLICY "Users can insert their own Studio AI usage" ON public.studio_ai_usage
--     FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "Users can update their own Studio AI usage" ON public.studio_ai_usage
--     FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT * FROM (VALUES
      ('desk_ai_usage',   'Users can insert their own DeskAI usage'),
      ('desk_ai_usage',   'Users can update their own DeskAI usage'),
      ('studio_ai_usage', 'Users can insert their own Studio AI usage'),
      ('studio_ai_usage', 'Users can update their own Studio AI usage')
    ) AS t(tbl, pol)
  LOOP
    IF to_regclass('public.' || p.tbl) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.pol, p.tbl);
    END IF;
  END LOOP;
END
$$;
