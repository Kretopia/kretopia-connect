-- Fix infinite recursion in projects RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;

-- Create simpler, non-recursive policies
-- Policy for viewing projects
CREATE POLICY "Users can view their solo projects"
  ON projects FOR SELECT
  USING (
    match_id IS NULL AND created_by = auth.uid()
  );

CREATE POLICY "Users can view their matched projects"
  ON projects FOR SELECT
  USING (
    match_id IS NOT NULL 
    AND match_id IN (
      SELECT id FROM matches 
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Users can view projects they collaborate on"
  ON projects FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM project_collaborators 
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );

-- Policy for updating projects
CREATE POLICY "Users can update their solo projects"
  ON projects FOR UPDATE
  USING (
    match_id IS NULL AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their matched projects"
  ON projects FOR UPDATE
  USING (
    match_id IS NOT NULL 
    AND match_id IN (
      SELECT id FROM matches 
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects they collaborate on"
  ON projects FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM project_collaborators 
      WHERE user_id = auth.uid() AND status = 'accepted'
    )
  );