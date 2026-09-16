-- Real mutual-connections support for Events and Circle browse (P2, per
-- KRETO_PLATFORM_ACCELERATION_AUDIT.md §H): the dormant get_mutual_connections
-- RPC already existed with zero call sites, and CreatorBrowseGrid.tsx already
-- attempted its own client-side mutuals computation -- but connections' RLS
-- only lets a user see rows where they are user_id or connected_user_id, so
-- querying OTHER users' connection rows directly (as that component did)
-- silently returns nothing. This migration adds a batched, RLS-safe RPC for
-- "N mutual connections" across a whole list of people at once (a roster, a
-- browse grid) without an N+1 call per person, and hardens the existing
-- single-pair RPC at the same time.
--
-- get_mutual_connections was SECURITY DEFINER with no check that the caller
-- is actually one of the two users being queried -- any authenticated caller
-- could already ask for the mutual-connection list between two arbitrary
-- strangers, a real information leak the connections table's own RLS would
-- otherwise block. It has zero call sites today, so this was dormant, not
-- exploited -- closing it now, before this migration gives it (and its new
-- sibling below) real callers.

CREATE OR REPLACE FUNCTION public.get_mutual_connections(user1_id uuid, user2_id uuid)
RETURNS TABLE(
  connection_id uuid,
  full_name text,
  avatar_url text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> user1_id AND auth.uid() <> user2_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.user_id as connection_id,
    p.full_name,
    p.avatar_url,
    p.role
  FROM profiles p
  WHERE p.user_id IN (
    SELECT c1.connected_user_id FROM connections c1
    WHERE c1.user_id = user1_id AND c1.status = 'accepted'
    UNION
    SELECT c1.user_id FROM connections c1
    WHERE c1.connected_user_id = user1_id AND c1.status = 'accepted'
  )
  AND p.user_id IN (
    SELECT c2.connected_user_id FROM connections c2
    WHERE c2.user_id = user2_id AND c2.status = 'accepted'
    UNION
    SELECT c2.user_id FROM connections c2
    WHERE c2.connected_user_id = user2_id AND c2.status = 'accepted'
  )
  AND p.user_id != user1_id
  AND p.user_id != user2_id;
END;
$$;

-- Batched version: mutual-connection count + up to 3 sample names/avatars for
-- the current caller against a whole list of target users in one round trip.
-- Derives the caller from auth.uid() directly rather than trusting a passed
-- parameter, so it's not spoofable the way an unchecked user1_id param would be.
CREATE OR REPLACE FUNCTION public.get_mutual_connection_counts(p_target_ids uuid[])
RETURNS TABLE(target_id uuid, mutual_count integer, sample jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH my_connections AS (
    SELECT connected_user_id AS other_id FROM connections WHERE user_id = v_user_id AND status = 'accepted'
    UNION
    SELECT user_id AS other_id FROM connections WHERE connected_user_id = v_user_id AND status = 'accepted'
  ),
  target_connections AS (
    SELECT user_id AS t_id, connected_user_id AS other_id
    FROM connections
    WHERE user_id = ANY(p_target_ids) AND status = 'accepted'
    UNION
    SELECT connected_user_id AS t_id, user_id AS other_id
    FROM connections
    WHERE connected_user_id = ANY(p_target_ids) AND status = 'accepted'
  ),
  mutuals AS (
    SELECT tc.t_id, tc.other_id
    FROM target_connections tc
    JOIN my_connections mc ON mc.other_id = tc.other_id
    WHERE tc.t_id <> v_user_id AND tc.other_id <> v_user_id AND tc.other_id <> tc.t_id
  )
  SELECT
    m.t_id AS target_id,
    COUNT(*)::int AS mutual_count,
    (
      SELECT jsonb_agg(jsonb_build_object('full_name', s.full_name, 'avatar_url', s.avatar_url))
      FROM (
        SELECT p2.full_name, p2.avatar_url
        FROM mutuals m2
        JOIN profiles p2 ON p2.user_id = m2.other_id
        WHERE m2.t_id = m.t_id
        ORDER BY p2.full_name
        LIMIT 3
      ) s
    ) AS sample
  FROM mutuals m
  GROUP BY m.t_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_mutual_connections(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_mutual_connection_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_mutual_connections(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mutual_connection_counts(uuid[]) TO authenticated;
