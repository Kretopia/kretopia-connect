CREATE OR REPLACE FUNCTION public.notify_application_status(_application_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _application RECORD;
  _opportunity RECORD;
  _title text;
  _message text;
BEGIN
  IF _status NOT IN ('shortlisted', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
  END IF;

  SELECT * INTO _application FROM public.applications WHERE id = _application_id;
  IF _application IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  SELECT * INTO _opportunity FROM public.opportunities WHERE id = _application.opportunity_id;
  IF _opportunity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'opportunity_not_found');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> _opportunity.created_by THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  IF _status = 'shortlisted' THEN
    _title := 'You''ve been shortlisted ⭐';
    _message := 'You made the shortlist for: ' || _opportunity.title;
  ELSE
    _title := 'Application update';
    _message := 'The poster chose someone else for: ' || _opportunity.title;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, link, action_url, action_text, priority, category, dedupe_key
  )
  VALUES (
    _application.applicant_id,
    'opportunity',
    _title,
    _message,
    '/opportunity/' || _opportunity.id::text,
    '/opportunity/' || _opportunity.id::text,
    'View',
    'normal',
    'opportunity',
    'app-status:' || _application_id::text || ':' || _status
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_application_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_application_status(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_application(_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _application RECORD;
  _opportunity RECORD;
BEGIN
  SELECT * INTO _application FROM public.applications WHERE id = _application_id;
  IF _application IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'application_not_found');
  END IF;

  IF auth.uid() IS NULL OR auth.uid() <> _application.applicant_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT * INTO _opportunity FROM public.opportunities WHERE id = _application.opportunity_id;
  IF _opportunity IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'opportunity_not_found');
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, message, link, action_url, action_text, priority, category, dedupe_key
  )
  VALUES (
    _opportunity.created_by,
    'opportunity',
    'New Application Received!',
    'Someone applied to: ' || _opportunity.title,
    '/opportunity-dashboard?opportunity=' || _opportunity.id::text,
    '/opportunity-dashboard?opportunity=' || _opportunity.id::text,
    'View Applicants',
    'normal',
    'opportunity',
    'new-application:' || _application_id::text
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_new_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_new_application(uuid) TO authenticated;