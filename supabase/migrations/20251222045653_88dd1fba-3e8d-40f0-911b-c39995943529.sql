-- Create function to find the connection path between two users (up to 3 degrees)
CREATE OR REPLACE FUNCTION public.get_connection_path(from_user_id UUID, to_user_id UUID)
RETURNS TABLE (
  degree INT,
  path_user_ids UUID[],
  path_user_names TEXT[]
) AS $$
BEGIN
  -- Check if same user
  IF from_user_id = to_user_id THEN
    RETURN QUERY SELECT 0::INT, ARRAY[from_user_id], ARRAY['You'::TEXT];
    RETURN;
  END IF;

  -- Check for 1st degree connection (direct)
  IF EXISTS (
    SELECT 1 FROM connections 
    WHERE ((user_id = from_user_id AND connected_user_id = to_user_id) 
       OR (user_id = to_user_id AND connected_user_id = from_user_id))
    AND status = 'accepted'
  ) THEN
    RETURN QUERY SELECT 1::INT, ARRAY[from_user_id, to_user_id], ARRAY['You'::TEXT, (SELECT full_name FROM profiles WHERE user_id = to_user_id)];
    RETURN;
  END IF;

  -- Check for 2nd degree connection (through one mutual)
  RETURN QUERY
  WITH user1_connections AS (
    SELECT connected_user_id as uid FROM connections WHERE user_id = from_user_id AND status = 'accepted'
    UNION
    SELECT user_id as uid FROM connections WHERE connected_user_id = from_user_id AND status = 'accepted'
  ),
  user2_connections AS (
    SELECT connected_user_id as uid FROM connections WHERE user_id = to_user_id AND status = 'accepted'
    UNION
    SELECT user_id as uid FROM connections WHERE connected_user_id = to_user_id AND status = 'accepted'
  ),
  mutual AS (
    SELECT u1.uid as mutual_id
    FROM user1_connections u1
    INNER JOIN user2_connections u2 ON u1.uid = u2.uid
    LIMIT 1
  )
  SELECT 
    2::INT as degree,
    ARRAY[from_user_id, m.mutual_id, to_user_id] as path_user_ids,
    ARRAY['You'::TEXT, (SELECT full_name FROM profiles WHERE user_id = m.mutual_id), (SELECT full_name FROM profiles WHERE user_id = to_user_id)] as path_user_names
  FROM mutual m
  LIMIT 1;

  -- If 2nd degree found, exit
  IF FOUND THEN
    RETURN;
  END IF;

  -- Check for 3rd degree (through two intermediaries)
  RETURN QUERY
  WITH user1_connections AS (
    SELECT connected_user_id as uid FROM connections WHERE user_id = from_user_id AND status = 'accepted'
    UNION
    SELECT user_id as uid FROM connections WHERE connected_user_id = from_user_id AND status = 'accepted'
  ),
  user2_connections AS (
    SELECT connected_user_id as uid FROM connections WHERE user_id = to_user_id AND status = 'accepted'
    UNION
    SELECT user_id as uid FROM connections WHERE connected_user_id = to_user_id AND status = 'accepted'
  ),
  degree2_from_user1 AS (
    SELECT c1.uid as first_hop, 
           CASE WHEN c2.user_id = c1.uid THEN c2.connected_user_id ELSE c2.user_id END as second_hop
    FROM user1_connections c1
    JOIN connections c2 ON (c2.user_id = c1.uid OR c2.connected_user_id = c1.uid) AND c2.status = 'accepted'
    WHERE CASE WHEN c2.user_id = c1.uid THEN c2.connected_user_id ELSE c2.user_id END != from_user_id
  ),
  path_3 AS (
    SELECT d2.first_hop, d2.second_hop
    FROM degree2_from_user1 d2
    INNER JOIN user2_connections u2 ON d2.second_hop = u2.uid
    LIMIT 1
  )
  SELECT 
    3::INT as degree,
    ARRAY[from_user_id, p.first_hop, p.second_hop, to_user_id] as path_user_ids,
    ARRAY[
      'You'::TEXT, 
      (SELECT full_name FROM profiles WHERE user_id = p.first_hop), 
      (SELECT full_name FROM profiles WHERE user_id = p.second_hop),
      (SELECT full_name FROM profiles WHERE user_id = to_user_id)
    ] as path_user_names
  FROM path_3 p
  LIMIT 1;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;