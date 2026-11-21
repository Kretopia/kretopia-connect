-- LOT K4 -- a rolling summary per Kreto conversation, and a web research consent setting -- 02 APPLY. Run it ONLY in the SQL Editor of
-- "kretopia-app", after 01_preflight.sql returned its findings. One transaction. One new table with its trigger and read policy, one new
-- column with a default. It changes no existing row's meaning: every orch_settings row reads 'ask', which is what Kreto does today.
--
-- Compatibility: nothing deployed reads or writes either object. Inserts into orch_settings that omit the column get 'ask'. Deleting a
-- conversation deletes its summary (ON DELETE CASCADE).
-- Order: SQL first; the code that writes summaries and reads the consent comes later, in its own pull request. That code must keep the memory
-- switch's rule: a summary condenses only what the chat would otherwise send as history, and stores no secret (_shared/memoryPolicy.ts).

BEGIN;

DO $assert$
BEGIN
  IF to_regclass('public.ai_conversations') IS NULL OR to_regclass('public.orch_settings') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: ai_conversations or orch_settings is missing. Nothing was changed.';
  END IF;
  IF to_regclass('public.ai_conversation_summaries') IS NOT NULL
     OR to_regprocedure('public.set_ai_conversation_summary_owner()') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_settings' AND column_name = 'web_research_consent') THEN
    RAISE EXCEPTION 'APPLY STOPPED: an object of this lot already exists. Nothing was changed.';
  END IF;
END
$assert$;

CREATE TABLE public.ai_conversation_summaries (
  conversation_id uuid PRIMARY KEY REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 8000),
  covers_through timestamptz NOT NULL,   -- created_at of the newest message folded into the summary
  message_count integer NOT NULL CHECK (message_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ai_conversation_summaries IS 'Kreto: condensed older messages of one conversation. Written by the server only; the owner may read it.';

-- The owner is always the conversation's owner, whatever the writer passed.
CREATE FUNCTION public.set_ai_conversation_summary_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  SELECT c.user_id INTO NEW.user_id FROM public.ai_conversations c WHERE c.id = NEW.conversation_id;
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'conversation % does not exist', NEW.conversation_id USING ERRCODE = '23503';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;
CREATE TRIGGER trg_set_ai_conversation_summary_owner
  BEFORE INSERT OR UPDATE ON public.ai_conversation_summaries
  FOR EACH ROW EXECUTE FUNCTION public.set_ai_conversation_summary_owner();

ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_conversation_summaries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_conversation_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversation_summaries TO service_role;
CREATE POLICY "Owners read their conversation summary" ON public.ai_conversation_summaries
  FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.orch_settings
  ADD COLUMN web_research_consent text NOT NULL DEFAULT 'ask'
  CONSTRAINT orch_settings_web_research_consent_values CHECK (web_research_consent IN ('ask', 'allow', 'off'));
COMMENT ON COLUMN public.orch_settings.web_research_consent IS 'Kreto web research: ask (each time, default), allow (without asking each time) or off (never). Set by the member.';

COMMIT;

SELECT 'applied' AS result,
       (SELECT count(*) FROM public.orch_settings WHERE web_research_consent = 'ask') AS settings_rows_reading_ask,
       'now run 03_verify.sql' AS next_step;
