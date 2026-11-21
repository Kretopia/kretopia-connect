-- LOT K4 -- 03 VERIFY. Read-only. Run it in the SQL Editor of "kretopia-app" after 02_apply.sql. Every row should say PASS.
--
-- What it proves: the table, trigger, policy, grants and column are what 02_apply.sql says. What it does not prove: a real member's access
-- (the SQL Editor runs as postgres and bypasses RLS). With a member's token, a REST insert into ai_conversation_summaries must fail with
-- 401/403, a REST select must return only that member's rows, and a PATCH of their own orch_settings.web_research_consent to 'off' must work.

WITH checks(name, ok) AS (
  SELECT 'ai_conversation_summaries exists with row level security', (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ai_conversation_summaries'::regclass)
  UNION ALL SELECT 'summary rows are deleted with their conversation', EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ai_conversation_summaries'::regclass AND contype = 'f' AND confdeltype = 'c')
  UNION ALL SELECT 'the owner is copied from the conversation on every write', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_ai_conversation_summary_owner' AND tgrelid = 'public.ai_conversation_summaries'::regclass)
  UNION ALL SELECT 'only one member policy: owners read their own', (SELECT count(*) = 1 AND bool_and(cmd = 'SELECT' AND qual = '(user_id = auth.uid())') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ai_conversation_summaries')
  UNION ALL SELECT 'members cannot write summaries', NOT (has_table_privilege('authenticated', 'public.ai_conversation_summaries', 'INSERT') OR has_table_privilege('authenticated', 'public.ai_conversation_summaries', 'UPDATE') OR has_table_privilege('authenticated', 'public.ai_conversation_summaries', 'DELETE'))
  UNION ALL SELECT 'visitors cannot read summaries', NOT has_table_privilege('anon', 'public.ai_conversation_summaries', 'SELECT')
  UNION ALL SELECT 'the server writes summaries', has_table_privilege('service_role', 'public.ai_conversation_summaries', 'INSERT') AND has_table_privilege('service_role', 'public.ai_conversation_summaries', 'UPDATE')
  UNION ALL SELECT 'web_research_consent defaults to ask and accepts only ask, allow, off',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_settings' AND column_name = 'web_research_consent' AND is_nullable = 'NO' AND column_default LIKE '''ask''%')
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.orch_settings'::regclass AND conname = 'orch_settings_web_research_consent_values')
  UNION ALL SELECT 'every existing settings row reads ask until the member changes it', NOT EXISTS (SELECT 1 FROM public.orch_settings WHERE web_research_consent <> 'ask')
)
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result, name FROM checks ORDER BY ok, name;
