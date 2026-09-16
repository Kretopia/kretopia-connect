CREATE OR REPLACE FUNCTION public.notify_scout_event(
  _opportunity_id uuid,
  _event text,
  _actor_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _scout uuid;
  _creator uuid;
  _title text;
  _caller uuid := auth.uid();
  _has_application boolean;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT scouted_by, created_by, title
    INTO _scout, _creator, _title
  FROM public.opportunities
  WHERE id = _opportunity_id;

  -- No scout to notify, or scout is the actor themselves: nothing to do
  IF _scout IS NULL OR _scout = _caller THEN
    RETURN;
  END IF;

  IF _event = 'claimed' THEN
    -- Caller must be the new creator (the claimer)
    IF _caller <> _creator THEN
      RAISE EXCEPTION 'Only the gig owner can emit claim notifications';
    END IF;

    INSERT INTO public.notifications (user_id, type, category, title, message, action_text, action_url, link, priority)
    VALUES (
      _scout,
      'scouted_gig_claimed',
      'opportunity',
      'Your scouted gig was claimed',
      COALESCE(_actor_name, 'Someone') || ' claimed "' || _title || '" — they can now review applicants.',
      'View gig',
      '/opportunity/' || _opportunity_id,
      '/opportunity/' || _opportunity_id,
      'high'
    );

  ELSIF _event = 'applied' THEN
    -- Caller must have an application on this opportunity
    SELECT EXISTS (
      SELECT 1 FROM public.applications
      WHERE opportunity_id = _opportunity_id AND applicant_id = _caller
    ) INTO _has_application;

    IF NOT _has_application THEN
      RAISE EXCEPTION 'Caller has not applied to this opportunity';
    END IF;

    INSERT INTO public.notifications (user_id, type, category, title, message, action_text, action_url, link, priority)
    VALUES (
      _scout,
      'scouted_gig_application',
      'opportunity',
      'New applicant on your scouted gig',
      COALESCE(_actor_name, 'Someone') || ' applied to "' || _title || '" — share their profile with the client.',
      'Review applicant',
      '/opportunity-dashboard?opportunity=' || _opportunity_id,
      '/opportunity-dashboard?opportunity=' || _opportunity_id,
      'high'
    );
  ELSE
    RAISE EXCEPTION 'Unknown event: %', _event;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_scout_event(uuid, text, text) TO authenticated;