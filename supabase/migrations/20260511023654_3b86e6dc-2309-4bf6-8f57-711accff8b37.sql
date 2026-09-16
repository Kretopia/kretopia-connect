
-- Admin-only aggregate stats for the Scout → Apply → Win funnel.

CREATE OR REPLACE FUNCTION public.get_scout_funnel_stats(_days int DEFAULT 30)
RETURNS TABLE (
  scouted bigint,
  opened bigint,
  drafted bigint,
  apply_clicked bigint,
  applied bigint,
  won bigint,
  lost bigint,
  ghosted bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH win AS (
    SELECT (now() - make_interval(days => GREATEST(_days, 1)))::timestamptz AS since
  ),
  s AS (
    SELECT COUNT(*)::bigint AS scouted
    FROM public.scouted_gigs, win
    WHERE scouted_at >= win.since
  ),
  a AS (
    SELECT
      COUNT(*) FILTER (WHERE action = 'opened')::bigint AS opened,
      COUNT(*) FILTER (WHERE action = 'drafted')::bigint AS drafted,
      COUNT(*) FILTER (WHERE action = 'apply_clicked')::bigint AS apply_clicked,
      COUNT(*) FILTER (WHERE action = 'applied')::bigint AS applied,
      COUNT(*) FILTER (WHERE action = 'applied' AND outcome = 'won')::bigint AS won,
      COUNT(*) FILTER (WHERE action = 'applied' AND outcome = 'lost')::bigint AS lost,
      COUNT(*) FILTER (WHERE action = 'applied' AND outcome = 'ghosted')::bigint AS ghosted
    FROM public.scouted_gig_actions, win
    WHERE created_at >= win.since
      AND public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  SELECT s.scouted, a.opened, a.drafted, a.apply_clicked, a.applied, a.won, a.lost, a.ghosted
  FROM s, a
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.get_scout_funnel_by_source(_days int DEFAULT 30)
RETURNS TABLE (
  source text,
  scouted bigint,
  opened bigint,
  applied bigint,
  won bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH win AS (
    SELECT (now() - make_interval(days => GREATEST(_days, 1)))::timestamptz AS since
  ),
  base AS (
    SELECT g.id, g.source
    FROM public.scouted_gigs g, win
    WHERE g.scouted_at >= win.since
  ),
  acts AS (
    SELECT b.source,
      COUNT(*) FILTER (WHERE a.action = 'opened')::bigint AS opened,
      COUNT(*) FILTER (WHERE a.action = 'applied')::bigint AS applied,
      COUNT(*) FILTER (WHERE a.action = 'applied' AND a.outcome = 'won')::bigint AS won
    FROM base b
    LEFT JOIN public.scouted_gig_actions a ON a.scouted_gig_id = b.id
    GROUP BY b.source
  ),
  scouts AS (
    SELECT source, COUNT(*)::bigint AS scouted FROM base GROUP BY source
  )
  SELECT
    s.source,
    s.scouted,
    COALESCE(a.opened, 0) AS opened,
    COALESCE(a.applied, 0) AS applied,
    COALESCE(a.won, 0) AS won
  FROM scouts s
  LEFT JOIN acts a ON a.source = s.source
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
  ORDER BY s.scouted DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_scout_funnel_stats(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_scout_funnel_by_source(int) TO authenticated;
