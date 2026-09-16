-- 1. Notification dedupe key
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_key_uidx
  ON public.notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 2. Application -> Studio link (makes acceptance idempotent)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS studio_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Canonical acceptance flow
CREATE OR REPLACE FUNCTION public.accept_application_and_create_studio(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app       public.applications%ROWTYPE;
  _opp       public.opportunities%ROWTYPE;
  _caller    uuid := auth.uid();
  _project   uuid;
  _created   boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _app FROM public.applications WHERE id = _application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  SELECT * INTO _opp FROM public.opportunities WHERE id = _app.opportunity_id;
  IF NOT FOUND OR _opp.created_by IS DISTINCT FROM _caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- Idempotent: reuse the Studio already created for this application
  IF _app.studio_project_id IS NOT NULL THEN
    _project := _app.studio_project_id;
  ELSE
    INSERT INTO public.projects (title, description, created_by, status)
    VALUES (_opp.title,
            'Project created from opportunity: ' || _opp.title,
            _caller,
            'active')
    RETURNING id INTO _project;
    _created := true;

    UPDATE public.applications
       SET studio_project_id = _project,
           status = 'accepted',
           updated_at = now()
     WHERE id = _application_id;
  END IF;

  UPDATE public.applications
     SET status = 'accepted', updated_at = now()
   WHERE id = _application_id AND status IS DISTINCT FROM 'accepted';

  -- Applicant gains authorized Studio access (idempotent)
  INSERT INTO public.project_collaborators (project_id, user_id, invited_by, role, status, accepted_at)
  SELECT _project, _app.applicant_id, _caller, 'member', 'accepted', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.project_collaborators
     WHERE project_id = _project AND user_id = _app.applicant_id
  );

  UPDATE public.project_collaborators
     SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
   WHERE project_id = _project AND user_id = _app.applicant_id AND status <> 'accepted';

  -- Exactly one notification, after the Studio exists
  INSERT INTO public.notifications
    (user_id, type, title, message, action_url, action_text, category, priority, dedupe_key)
  VALUES
    (_app.applicant_id,
     'opportunity',
     'You''re hired',
     'You got the gig: ' || _opp.title,
     '/desk/' || _project::text,
     'Open Studio',
     'opportunity',
     'high',
     'studio-created:' || _project::text || ':applicant:' || _app.applicant_id::text)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', _project,
    'studio_created', _created,
    'applicant_id', _app.applicant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_application_and_create_studio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_application_and_create_studio(uuid) TO authenticated;