-- Allow users to view profiles of their accepted connections
CREATE POLICY "Users can view connected user profiles"
ON public.profiles
FOR SELECT
USING (
  user_id IN (
    -- Users I'm connected to (outgoing accepted)
    SELECT connected_user_id FROM connections 
    WHERE user_id = auth.uid() AND status = 'accepted'
    UNION
    -- Users connected to me (incoming accepted)
    SELECT user_id FROM connections 
    WHERE connected_user_id = auth.uid() AND status = 'accepted'
  )
);