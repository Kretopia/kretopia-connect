-- Default new communities to private
ALTER TABLE public.communities
  ALTER COLUMN is_private SET DEFAULT true;

-- Flip existing public communities to private
UPDATE public.communities
SET is_private = true
WHERE is_private IS DISTINCT FROM true;

-- Per-user unread counter across all crews (drives hamburger badge)
CREATE OR REPLACE FUNCTION public.get_my_crew_unread()
RETURNS TABLE (
  crew_id uuid,
  unread_count bigint,
  last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_crews AS (
    SELECT cm.community_id AS crew_id, cm.joined_at
    FROM public.community_members cm
    WHERE cm.user_id = auth.uid()
  )
  SELECT
    mc.crew_id,
    COALESCE(COUNT(cp.id), 0)::bigint AS unread_count,
    MAX(cp.created_at) AS last_activity_at
  FROM my_crews mc
  LEFT JOIN public.community_posts cp
    ON cp.community_id = mc.crew_id
   AND cp.created_at > mc.joined_at
   AND cp.user_id <> auth.uid()
  GROUP BY mc.crew_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_crew_unread() TO authenticated;