
DO $$ BEGIN
  CREATE TYPE public.agent_persona AS ENUM ('scout','producer','archivist','deal','orchestrator');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.orch_actions
  ADD COLUMN IF NOT EXISTS persona public.agent_persona NOT NULL DEFAULT 'orchestrator';

CREATE OR REPLACE FUNCTION public.persona_for_agent_kind(_kind text)
RETURNS public.agent_persona
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _kind
    WHEN 'talent' THEN 'scout'::public.agent_persona
    WHEN 'gig' THEN 'scout'::public.agent_persona
    WHEN 'opportunity' THEN 'scout'::public.agent_persona
    WHEN 'project_manager' THEN 'producer'::public.agent_persona
    WHEN 'event' THEN 'producer'::public.agent_persona
    WHEN 'site_epk' THEN 'producer'::public.agent_persona
    WHEN 'profile' THEN 'producer'::public.agent_persona
    WHEN 'credit' THEN 'archivist'::public.agent_persona
    WHEN 'client_followup' THEN 'archivist'::public.agent_persona
    WHEN 'money_admin' THEN 'archivist'::public.agent_persona
    WHEN 'payment' THEN 'deal'::public.agent_persona
    ELSE 'orchestrator'::public.agent_persona
  END
$$;

CREATE OR REPLACE FUNCTION public.set_orch_action_persona()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _kind text;
BEGIN
  IF NEW.persona IS NULL OR NEW.persona = 'orchestrator' THEN
    SELECT agent_kind::text INTO _kind FROM public.orch_tool_registry WHERE tool_name = NEW.tool_name LIMIT 1;
    IF _kind IS NOT NULL THEN
      NEW.persona := public.persona_for_agent_kind(_kind);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_orch_action_persona ON public.orch_actions;
CREATE TRIGGER trg_set_orch_action_persona
BEFORE INSERT ON public.orch_actions
FOR EACH ROW EXECUTE FUNCTION public.set_orch_action_persona();

UPDATE public.orch_actions a
SET persona = public.persona_for_agent_kind(r.agent_kind::text)
FROM public.orch_tool_registry r
WHERE a.tool_name = r.tool_name AND a.persona = 'orchestrator';
