-- Notify project owner + collaborators when a runsheet cue is flagged at_risk
CREATE OR REPLACE FUNCTION public.notify_runsheet_at_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_title text;
  v_owner uuid;
  v_recipient uuid;
BEGIN
  IF NEW.status <> 'at_risk' OR (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  SELECT title, created_by INTO v_project_title, v_owner
  FROM public.projects WHERE id = NEW.project_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify owner + collaborators (distinct)
  FOR v_recipient IN
    SELECT DISTINCT uid FROM (
      SELECT v_owner AS uid
      UNION
      SELECT user_id FROM public.project_collaborators WHERE project_id = NEW.project_id AND user_id IS NOT NULL
    ) sub
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url, action_text, category, priority)
    VALUES (
      v_recipient,
      'event_runsheet_risk',
      'Cue flagged at risk',
      COALESCE(NEW.title, 'Run sheet item') || ' — ' || COALESCE(v_project_title, 'event') ,
      '/desk/' || NEW.project_id::text || '/crew',
      'Open crew mode',
      'event',
      'high'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_runsheet_at_risk ON public.event_runsheet_items;
CREATE TRIGGER trg_notify_runsheet_at_risk
AFTER UPDATE OF status ON public.event_runsheet_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_runsheet_at_risk();