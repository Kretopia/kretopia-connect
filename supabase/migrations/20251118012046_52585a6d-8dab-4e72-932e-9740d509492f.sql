-- Fix infinite recursion in community_members RLS policies
DROP POLICY IF EXISTS "Users can view community members" ON community_members;
DROP POLICY IF EXISTS "Users can join communities" ON community_members;
DROP POLICY IF EXISTS "Users can leave communities" ON community_members;

-- Simple, non-recursive policies
CREATE POLICY "Anyone can view community members"
  ON community_members FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can join communities"
  ON community_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave their own memberships"
  ON community_members FOR DELETE
  USING (auth.uid() = user_id);