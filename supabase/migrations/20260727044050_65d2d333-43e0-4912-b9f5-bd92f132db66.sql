
CREATE OR REPLACE FUNCTION public.notify_credit_owner_on_endorsement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
  _project text;
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT c.user_id, c.project_name INTO _owner_id, _project
    FROM public.credits c WHERE c.id = NEW.credit_id;

    IF _owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, action_url, action_text, category, priority)
      VALUES (
        _owner_id,
        'credit_cosigned',
        'New co-sign on your credit',
        COALESCE(NEW.endorser_name, 'Someone') || ' verified your work on ' || COALESCE(_project, 'a project'),
        '/profile?tab=credits',
        'View Passport',
        'credits',
        'normal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_credit_owner_on_endorsement ON public.credit_endorsements;
CREATE TRIGGER trg_notify_credit_owner_on_endorsement
AFTER UPDATE ON public.credit_endorsements
FOR EACH ROW
EXECUTE FUNCTION public.notify_credit_owner_on_endorsement();
