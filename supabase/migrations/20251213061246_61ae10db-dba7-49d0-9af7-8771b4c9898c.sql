-- Fix RLS policies for matching system

-- 1. Add INSERT policy for notifications (needed to create match notifications)
CREATE POLICY "Authenticated users can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Fix connections INSERT policy to allow creating connections for mutual matches
-- First drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create connections" ON public.connections;

-- Create a more permissive policy for connections during matches
-- Users can create a connection if they are the user_id OR if there's a mutual swipe (both swiped right)
CREATE POLICY "Users can create connections for matches"
ON public.connections
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR (
    -- Allow creating connection for the other user if mutual swipe exists
    EXISTS (
      SELECT 1 FROM swipes s1
      WHERE s1.user_id = auth.uid()
      AND s1.target_id = connections.user_id
      AND s1.direction = 'right'
    )
    AND EXISTS (
      SELECT 1 FROM swipes s2
      WHERE s2.user_id = connections.user_id
      AND s2.target_id = auth.uid()
      AND s2.direction = 'right'
    )
  )
);