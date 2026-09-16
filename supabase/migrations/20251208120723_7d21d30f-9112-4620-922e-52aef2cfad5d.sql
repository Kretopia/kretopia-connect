-- Add invited_by column to profiles to track invitation chains
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- Create index for faster lookups of invitation chains
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON public.profiles(invited_by);

-- Create a function to get network stats for a user
CREATE OR REPLACE FUNCTION public.get_network_stats(p_user_id UUID)
RETURNS TABLE (
  degree INT,
  connection_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH degree_1 AS (
    -- 1st degree: Direct matches
    SELECT DISTINCT 
      CASE WHEN m.user1_id = p_user_id THEN m.user2_id ELSE m.user1_id END as user_id
    FROM matches m
    WHERE (m.user1_id = p_user_id OR m.user2_id = p_user_id)
      AND m.status = 'matched'
    UNION
    -- 1st degree: Direct invites (you invited or invited by)
    SELECT p.user_id FROM profiles p WHERE p.invited_by = p_user_id
    UNION
    SELECT p.invited_by FROM profiles p WHERE p.user_id = p_user_id AND p.invited_by IS NOT NULL
  ),
  degree_2 AS (
    -- 2nd degree: Connections of 1st degree (excluding 1st degree and self)
    SELECT DISTINCT 
      CASE WHEN m.user1_id = d1.user_id THEN m.user2_id ELSE m.user1_id END as user_id
    FROM degree_1 d1
    JOIN matches m ON (m.user1_id = d1.user_id OR m.user2_id = d1.user_id)
    WHERE m.status = 'matched'
      AND CASE WHEN m.user1_id = d1.user_id THEN m.user2_id ELSE m.user1_id END != p_user_id
      AND CASE WHEN m.user1_id = d1.user_id THEN m.user2_id ELSE m.user1_id END NOT IN (SELECT user_id FROM degree_1)
  ),
  degree_3 AS (
    -- 3rd degree: Connections of 2nd degree (excluding previous degrees and self)
    SELECT DISTINCT 
      CASE WHEN m.user1_id = d2.user_id THEN m.user2_id ELSE m.user1_id END as user_id
    FROM degree_2 d2
    JOIN matches m ON (m.user1_id = d2.user_id OR m.user2_id = d2.user_id)
    WHERE m.status = 'matched'
      AND CASE WHEN m.user1_id = d2.user_id THEN m.user2_id ELSE m.user1_id END != p_user_id
      AND CASE WHEN m.user1_id = d2.user_id THEN m.user2_id ELSE m.user1_id END NOT IN (SELECT user_id FROM degree_1)
      AND CASE WHEN m.user1_id = d2.user_id THEN m.user2_id ELSE m.user1_id END NOT IN (SELECT user_id FROM degree_2)
  )
  SELECT 1::INT as degree, COUNT(*) FROM degree_1
  UNION ALL
  SELECT 2::INT as degree, COUNT(*) FROM degree_2
  UNION ALL
  SELECT 3::INT as degree, COUNT(*) FROM degree_3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;