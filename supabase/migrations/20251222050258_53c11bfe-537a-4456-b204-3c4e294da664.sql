-- Drop and recreate get_network_stats to use connections table instead of matches
CREATE OR REPLACE FUNCTION public.get_network_stats(p_user_id UUID)
RETURNS TABLE(degree INT, connection_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH degree_1 AS (
    -- 1st degree: Direct connections (accepted)
    SELECT DISTINCT 
      CASE 
        WHEN c.user_id = p_user_id THEN c.connected_user_id 
        ELSE c.user_id 
      END as user_id
    FROM connections c
    WHERE (c.user_id = p_user_id OR c.connected_user_id = p_user_id)
      AND c.status = 'accepted'
  ),
  degree_2 AS (
    -- 2nd degree: Connections of 1st degree (excluding 1st degree and self)
    SELECT DISTINCT 
      CASE 
        WHEN c.user_id = d1.user_id THEN c.connected_user_id 
        ELSE c.user_id 
      END as user_id
    FROM degree_1 d1
    JOIN connections c ON (c.user_id = d1.user_id OR c.connected_user_id = d1.user_id)
    WHERE c.status = 'accepted'
      AND CASE WHEN c.user_id = d1.user_id THEN c.connected_user_id ELSE c.user_id END != p_user_id
      AND CASE WHEN c.user_id = d1.user_id THEN c.connected_user_id ELSE c.user_id END NOT IN (SELECT user_id FROM degree_1)
  ),
  degree_3 AS (
    -- 3rd degree: Connections of 2nd degree (excluding previous degrees and self)
    SELECT DISTINCT 
      CASE 
        WHEN c.user_id = d2.user_id THEN c.connected_user_id 
        ELSE c.user_id 
      END as user_id
    FROM degree_2 d2
    JOIN connections c ON (c.user_id = d2.user_id OR c.connected_user_id = d2.user_id)
    WHERE c.status = 'accepted'
      AND CASE WHEN c.user_id = d2.user_id THEN c.connected_user_id ELSE c.user_id END != p_user_id
      AND CASE WHEN c.user_id = d2.user_id THEN c.connected_user_id ELSE c.user_id END NOT IN (SELECT user_id FROM degree_1)
      AND CASE WHEN c.user_id = d2.user_id THEN c.connected_user_id ELSE c.user_id END NOT IN (SELECT user_id FROM degree_2)
  )
  SELECT 1::INT as degree, COUNT(*)::BIGINT FROM degree_1
  UNION ALL
  SELECT 2::INT as degree, COUNT(*)::BIGINT FROM degree_2
  UNION ALL
  SELECT 3::INT as degree, COUNT(*)::BIGINT FROM degree_3;
END;
$$;

-- Also update get_connection_path to use connections table
CREATE OR REPLACE FUNCTION public.get_connection_path(from_user_id UUID, to_user_id UUID)
RETURNS TABLE(
  degree INT,
  path_user_ids UUID[],
  path_user_names TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check for direct connection (1st degree)
  IF EXISTS (
    SELECT 1 FROM connections c
    WHERE c.status = 'accepted'
      AND ((c.user_id = from_user_id AND c.connected_user_id = to_user_id)
           OR (c.user_id = to_user_id AND c.connected_user_id = from_user_id))
  ) THEN
    RETURN QUERY
    SELECT 
      1::INT,
      ARRAY[from_user_id, to_user_id]::UUID[],
      ARRAY[
        (SELECT full_name FROM profiles WHERE user_id = from_user_id),
        (SELECT full_name FROM profiles WHERE user_id = to_user_id)
      ]::TEXT[];
    RETURN;
  END IF;

  -- Check for 2nd degree connection
  RETURN QUERY
  WITH mutual AS (
    SELECT DISTINCT
      CASE 
        WHEN c1.user_id = from_user_id THEN c1.connected_user_id 
        ELSE c1.user_id 
      END as mutual_id
    FROM connections c1
    JOIN connections c2 ON (
      (c2.user_id = to_user_id AND c2.connected_user_id = 
        CASE WHEN c1.user_id = from_user_id THEN c1.connected_user_id ELSE c1.user_id END)
      OR 
      (c2.connected_user_id = to_user_id AND c2.user_id = 
        CASE WHEN c1.user_id = from_user_id THEN c1.connected_user_id ELSE c1.user_id END)
    )
    WHERE c1.status = 'accepted' AND c2.status = 'accepted'
      AND (c1.user_id = from_user_id OR c1.connected_user_id = from_user_id)
    LIMIT 1
  )
  SELECT 
    2::INT,
    ARRAY[from_user_id, m.mutual_id, to_user_id]::UUID[],
    ARRAY[
      (SELECT full_name FROM profiles WHERE user_id = from_user_id),
      (SELECT full_name FROM profiles WHERE user_id = m.mutual_id),
      (SELECT full_name FROM profiles WHERE user_id = to_user_id)
    ]::TEXT[]
  FROM mutual m
  LIMIT 1;

  -- If no result yet, check for 3rd degree
  IF NOT FOUND THEN
    RETURN QUERY
    WITH first_degree AS (
      SELECT DISTINCT
        CASE WHEN c.user_id = from_user_id THEN c.connected_user_id ELSE c.user_id END as user_id
      FROM connections c
      WHERE c.status = 'accepted'
        AND (c.user_id = from_user_id OR c.connected_user_id = from_user_id)
    ),
    second_degree AS (
      SELECT DISTINCT
        fd.user_id as first_id,
        CASE WHEN c.user_id = fd.user_id THEN c.connected_user_id ELSE c.user_id END as second_id
      FROM first_degree fd
      JOIN connections c ON c.status = 'accepted' 
        AND (c.user_id = fd.user_id OR c.connected_user_id = fd.user_id)
      WHERE CASE WHEN c.user_id = fd.user_id THEN c.connected_user_id ELSE c.user_id END != from_user_id
    ),
    path_to_target AS (
      SELECT sd.first_id, sd.second_id
      FROM second_degree sd
      JOIN connections c ON c.status = 'accepted'
        AND (c.user_id = sd.second_id OR c.connected_user_id = sd.second_id)
      WHERE (c.user_id = to_user_id OR c.connected_user_id = to_user_id)
        AND sd.second_id != to_user_id
      LIMIT 1
    )
    SELECT 
      3::INT,
      ARRAY[from_user_id, p.first_id, p.second_id, to_user_id]::UUID[],
      ARRAY[
        (SELECT full_name FROM profiles WHERE user_id = from_user_id),
        (SELECT full_name FROM profiles WHERE user_id = p.first_id),
        (SELECT full_name FROM profiles WHERE user_id = p.second_id),
        (SELECT full_name FROM profiles WHERE user_id = to_user_id)
      ]::TEXT[]
    FROM path_to_target p
    LIMIT 1;
  END IF;
END;
$$;