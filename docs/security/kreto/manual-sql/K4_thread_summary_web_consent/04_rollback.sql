-- LOT K4 -- 04 ROLLBACK. Run it in the SQL Editor of "kretopia-app" only to undo 02_apply.sql.
--
-- It drops ai_conversation_summaries (every stored summary with it), its trigger function, and orch_settings.web_research_consent (every
-- member's choice with it). It stops if any member has chosen something other than 'ask', so that a choice is never discarded silently: to
-- discard those choices on purpose, run the UPDATE in the stop message first.
--
-- DOES THIS REINTRODUCE A WEAKNESS? No. Kreto goes back to sending up to 40 raw past messages and to asking before each web research.
-- Deploy the code that reads these objects only while they exist: roll back that code first.

BEGIN;

DO $assert$
DECLARE
  v_chosen bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orch_settings' AND column_name = 'web_research_consent') THEN
    EXECUTE 'SELECT count(*) FROM public.orch_settings WHERE web_research_consent <> ''ask''' INTO v_chosen;
    IF v_chosen > 0 THEN
      RAISE EXCEPTION 'ROLLBACK STOPPED: % members chose allow or off. To discard their choice: UPDATE public.orch_settings SET web_research_consent = ''ask''; then run this again. Nothing was changed.', v_chosen;
    END IF;
  END IF;
END
$assert$;

DROP TABLE IF EXISTS public.ai_conversation_summaries;
DROP FUNCTION IF EXISTS public.set_ai_conversation_summary_owner();
ALTER TABLE public.orch_settings DROP CONSTRAINT IF EXISTS orch_settings_web_research_consent_values;
ALTER TABLE public.orch_settings DROP COLUMN IF EXISTS web_research_consent;

COMMIT;

SELECT 'rolled back' AS result;
