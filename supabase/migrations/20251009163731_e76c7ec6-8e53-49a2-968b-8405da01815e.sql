-- Fix 1: Replace overly permissive profiles policy
-- First drop the problematic public policy if it exists
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Add connection-based viewing policy only if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Connected users can view profiles'
  ) THEN
    CREATE POLICY "Connected users can view profiles" ON public.profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM connections
        WHERE (user_id = auth.uid() AND connected_user_id = profiles.user_id AND status = 'accepted')
           OR (connected_user_id = auth.uid() AND user_id = profiles.user_id AND status = 'accepted')
      )
    );
  END IF;
END $$;

-- Fix 2: Secure conversation_list view
DROP VIEW IF EXISTS public.conversation_list;

CREATE VIEW public.conversation_list
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (conversation_id)
  m.id as message_id,
  m.sender_id,
  m.receiver_id,
  m.match_id,
  m.content,
  m.read,
  m.created_at,
  CASE 
    WHEN m.sender_id < m.receiver_id 
    THEN m.sender_id || '-' || m.receiver_id
    ELSE m.receiver_id || '-' || m.sender_id
  END as conversation_id,
  sp.full_name as sender_name,
  sp.avatar_url as sender_avatar,
  rp.full_name as receiver_name,
  rp.avatar_url as receiver_avatar
FROM messages m
LEFT JOIN profiles sp ON sp.user_id = m.sender_id
LEFT JOIN profiles rp ON rp.user_id = m.receiver_id
WHERE m.sender_id = auth.uid() OR m.receiver_id = auth.uid()
ORDER BY conversation_id, m.created_at DESC;

-- Fix 3: Ensure analytics is admin-only
-- The existing policy should already be restrictive, just verify no public ones exist
DROP POLICY IF EXISTS "Users can view analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Public can view analytics" ON public.analytics_events;