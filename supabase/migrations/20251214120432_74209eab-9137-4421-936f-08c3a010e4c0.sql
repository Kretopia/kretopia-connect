-- Create a secure function to create bidirectional connections (bypasses RLS)
-- This is used for welcome matches and QR code/referral auto-connections
CREATE OR REPLACE FUNCTION public.create_bidirectional_connection(
  user1_uuid UUID,
  user2_uuid UUID,
  connection_status TEXT DEFAULT 'accepted'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Don't allow connecting with yourself
  IF user1_uuid = user2_uuid THEN
    RAISE EXCEPTION 'Cannot connect with yourself';
  END IF;

  -- Insert both directions, ignoring if they already exist
  INSERT INTO connections (user_id, connected_user_id, status)
  VALUES (user1_uuid, user2_uuid, connection_status)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO connections (user_id, connected_user_id, status)
  VALUES (user2_uuid, user1_uuid, connection_status)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_bidirectional_connection TO authenticated;

-- Add a unique constraint on connections to prevent duplicates (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'connections_user_connected_unique'
  ) THEN
    ALTER TABLE connections ADD CONSTRAINT connections_user_connected_unique 
    UNIQUE (user_id, connected_user_id);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;