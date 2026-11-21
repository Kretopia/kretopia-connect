-- LOT K4 -- a rolling summary per Kreto conversation, and a web research consent setting -- 01 PREFLIGHT. Read-only. Run it in the SQL
-- Editor of "kretopia-app" only.
--
-- What 02_apply.sql adds, both new, nothing existing changed:
--   * public.ai_conversation_summaries: one row per conversation holding a condensed summary of its older messages, so that thrive-ai-chat
--     can send that summary plus the latest messages instead of up to 40 raw past messages. Written by the server (service role) only; the
--     owner can read their own (what Kreto carries forward should be visible to them); deleted with the conversation. The owner column is
--     copied from the conversation by a trigger, so a wrong user_id from code cannot make a summary readable by someone else.
--   * orch_settings.web_research_consent: 'ask' (default, today's behaviour: every web research tool asks each time), 'allow' (Kreto may
--     research the web without asking each time) or 'off' (never). Members already update their own orch_settings row; that is how they will
--     set it. Nothing reads it until the code change that uses it is deployed.
--
-- It stops with an error if a table it builds on is missing or a name is taken, then returns its findings.

DO $pre$
BEGIN
  IF to_regclass('public.ai_conversations') IS NULL OR to_regclass('public.ai_messages') IS NULL OR to_regclass('public.orch_settings') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: ai_conversations, ai_messages or orch_settings is missing. Is this kretopia-app?';
  END IF;
  IF to_regclass('public.ai_conversation_summaries') IS NOT NULL
     OR to_regprocedure('public.set_ai_conversation_summary_owner()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_settings' AND column_name = 'web_research_consent') THEN
    RAISE EXCEPTION 'PREFLIGHT STOPPED: an object of this lot already exists.';
  END IF;
END
$pre$;

SELECT 'column' AS finding, table_name || '.' || column_name AS name, data_type AS detail, is_nullable AS extra
FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('ai_conversations', 'orch_settings')
UNION ALL
SELECT 'policy', tablename || '.' || policyname, cmd, coalesce(qual, with_check)
FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('ai_conversations', 'orch_settings')
UNION ALL
SELECT 'rows', 'ai_conversations', count(*)::text, NULL FROM public.ai_conversations
UNION ALL
SELECT 'conversations_over_40_messages', 'ai_messages', count(*)::text, 'the conversations a summary would shorten'
FROM (SELECT conversation_id FROM public.ai_messages GROUP BY conversation_id HAVING count(*) > 40) s
UNION ALL
SELECT 'rows', 'orch_settings', count(*)::text, 'each gets web_research_consent = ask' FROM public.orch_settings
ORDER BY 1, 2;
