-- Add auto-connection when invite is used
CREATE OR REPLACE FUNCTION public.create_connection_on_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an invite is accepted (used_at is set), create automatic connection
  IF NEW.used_at IS NOT NULL AND OLD.used_at IS NULL THEN
    -- Create bidirectional connection
    INSERT INTO public.connections (user_id, connected_user_id, status)
    VALUES (NEW.inviter_id, NEW.used_by, 'accepted')
    ON CONFLICT DO NOTHING;
    
    INSERT INTO public.connections (user_id, connected_user_id, status)
    VALUES (NEW.used_by, NEW.inviter_id, 'accepted')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-connection
DROP TRIGGER IF EXISTS on_invite_used ON public.invites;
CREATE TRIGGER on_invite_used
  AFTER UPDATE ON public.invites
  FOR EACH ROW
  EXECUTE FUNCTION public.create_connection_on_invite();

-- Add mutual connections helper function
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
  RETURN QUERY
  SELECT DISTINCT
    p.user_id as connection_id,
    p.full_name,
    p.avatar_url,
    p.role
  FROM profiles p
  WHERE p.user_id IN (
    -- Get user1's connections
    SELECT c1.connected_user_id FROM connections c1 
    WHERE c1.user_id = user1_id AND c1.status = 'accepted'
    UNION
    SELECT c1.user_id FROM connections c1 
    WHERE c1.connected_user_id = user1_id AND c1.status = 'accepted'
  )
  AND p.user_id IN (
    -- Get user2's connections
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