CREATE OR REPLACE FUNCTION public.get_landing_funnel(
  _start timestamptz DEFAULT (now() - interval '7 days'),
  _end   timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_landing int; v_d25 int; v_d50 int; v_d75 int; v_d100 int;
  v_cta int; v_auth int; v_attempt int; v_created int;
  v_sections jsonb; v_ctas jsonb;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT count(DISTINCT coalesce(user_id::text, session_id))
    INTO v_landing
    FROM analytics_events
   WHERE created_at BETWEEN _start AND _end
     AND event_name = 'page_view' AND page_path = '/';

  SELECT
    count(DISTINCT coalesce(user_id::text, session_id)) FILTER (WHERE (event_properties->>'depth')::int >= 25),
    count(DISTINCT coalesce(user_id::text, session_id)) FILTER (WHERE (event_properties->>'depth')::int >= 50),
    count(DISTINCT coalesce(user_id::text, session_id)) FILTER (WHERE (event_properties->>'depth')::int >= 75),
    count(DISTINCT coalesce(user_id::text, session_id)) FILTER (WHERE (event_properties->>'depth')::int >= 100)
    INTO v_d25, v_d50, v_d75, v_d100
    FROM analytics_events
   WHERE created_at BETWEEN _start AND _end
     AND event_name = 'landing_scroll_depth';

  SELECT count(DISTINCT coalesce(user_id::text, session_id))
    INTO v_cta
    FROM analytics_events
   WHERE created_at BETWEEN _start AND _end
     AND event_name = 'cta_click';

  SELECT count(DISTINCT coalesce(user_id::text, session_id))
    INTO v_auth
    FROM analytics_events
   WHERE created_at BETWEEN _start AND _end
     AND event_name = 'page_view' AND page_path = '/auth';

  SELECT count(DISTINCT coalesce(user_id::text, session_id))
    INTO v_attempt
    FROM analytics_events
   WHERE created_at BETWEEN _start AND _end
     AND event_name IN ('signup_attempt', 'sign_up');

  SELECT count(*) INTO v_created
    FROM profiles WHERE created_at BETWEEN _start AND _end;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'section'), '[]'::jsonb)
    INTO v_sections
    FROM (
      SELECT jsonb_build_object(
               'section', event_properties->>'section',
               'index', coalesce((event_properties->>'index')::int, 99),
               'visitors', count(DISTINCT coalesce(user_id::text, session_id))
             ) AS x
        FROM analytics_events
       WHERE created_at BETWEEN _start AND _end
         AND event_name = 'landing_section_viewed'
         AND event_properties->>'section' IS NOT NULL
       GROUP BY event_properties->>'section', event_properties->>'index'
    ) s;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'clicks')::int DESC), '[]'::jsonb)
    INTO v_ctas
    FROM (
      SELECT jsonb_build_object(
               'cta', coalesce(event_properties->>'cta_id', event_properties->>'cta_name', 'unknown'),
               'section', coalesce(event_properties->>'section', event_properties->>'location', 'unknown'),
               'clicks', count(*),
               'visitors', count(DISTINCT coalesce(user_id::text, session_id))
             ) AS x
        FROM analytics_events
       WHERE created_at BETWEEN _start AND _end
         AND event_name = 'cta_click'
       GROUP BY 1
    ) c;

  RETURN jsonb_build_object(
    'steps', jsonb_build_array(
      jsonb_build_object('label','Landing visitors','count', v_landing),
      jsonb_build_object('label','Scrolled 25%',    'count', v_d25),
      jsonb_build_object('label','Scrolled 50%',    'count', v_d50),
      jsonb_build_object('label','Scrolled 75%',    'count', v_d75),
      jsonb_build_object('label','Clicked a CTA',   'count', v_cta),
      jsonb_build_object('label','Reached sign-up', 'count', v_auth),
      jsonb_build_object('label','Sign-up attempt', 'count', v_attempt),
      jsonb_build_object('label','Accounts created','count', v_created)
    ),
    'scroll_100', v_d100,
    'sections', v_sections,
    'ctas', v_ctas,
    'window', jsonb_build_object('start', _start, 'end', _end)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_landing_funnel(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.get_landing_funnel(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_landing_funnel(timestamptz, timestamptz) TO service_role;