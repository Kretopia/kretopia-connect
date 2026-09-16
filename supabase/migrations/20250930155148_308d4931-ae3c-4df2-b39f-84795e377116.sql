-- Add created_by column to projects table to track ownership of solo projects
ALTER TABLE projects ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Update existing projects to set created_by based on matches
UPDATE projects p
SET created_by = m.user1_id
FROM matches m
WHERE p.match_id = m.id AND p.created_by IS NULL;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view projects they're part of" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;

-- Create new RLS policies that handle both match-based and solo projects
CREATE POLICY "Users can view their projects"
ON projects FOR SELECT
USING (
  -- Solo projects: user is the creator
  (match_id IS NULL AND auth.uid() = created_by)
  OR
  -- Match-based projects: user is part of the match
  (match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ))
);

CREATE POLICY "Users can update their projects"
ON projects FOR UPDATE
USING (
  -- Solo projects: user is the creator
  (match_id IS NULL AND auth.uid() = created_by)
  OR
  -- Match-based projects: user is part of the match
  (match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ))
);