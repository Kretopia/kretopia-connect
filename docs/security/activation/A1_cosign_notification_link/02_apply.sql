-- LOT A1 -- 02 APPLY. SQL Editor of "kretopia-app" only, after 01_preflight.sql. One transaction; replaces one function body.
-- Needs the app build that reads /credits?credit=<id> (CreditsDashboard); an older build still opens /credits, never a dead end.
BEGIN;

DO $assert$
BEGIN
  IF to_regprocedure('public.notify_credit_owner_on_endorsement()') IS NULL THEN
    RAISE EXCEPTION 'APPLY STOPPED: notify_credit_owner_on_endorsement() is missing. Nothing was changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.notify_credit_owner_on_endorsement()'::regprocedure
                 AND prosrc LIKE '%/profile?tab=credits%' AND prosrc LIKE '%credit_cosigned%') THEN
    RAISE EXCEPTION 'APPLY STOPPED: the function is not the version this lot replaces (already applied, or changed by hand). Nothing was changed.';
  END IF;
END
$assert$;

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
        'A collaborator confirmed your credit',
        COALESCE(NULLIF(btrim(NEW.endorser_name), ''), 'A collaborator') || ' confirmed your credit on ' || COALESCE(_project, 'a project'),
        '/credits?credit=' || NEW.credit_id::text,
        'View credit',
        'credits',
        'normal'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
SELECT 'applied' AS result, 'now run 03_verify.sql' AS next_step;
