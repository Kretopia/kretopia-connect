-- Update RLS policies for project_tasks to handle solo projects
DROP POLICY IF EXISTS "Users can create tasks in their projects" ON project_tasks;
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON project_tasks;
DROP POLICY IF EXISTS "Users can update tasks in their projects" ON project_tasks;

CREATE POLICY "Users can create tasks in their projects"
ON project_tasks FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND (
    -- Solo projects: user is the creator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR
    -- Match-based projects: user is part of the match
    EXISTS (
      SELECT 1 FROM projects p
      JOIN matches m ON m.id = p.match_id
      WHERE p.id = project_tasks.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can view tasks in their projects"
ON project_tasks FOR SELECT
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update tasks in their projects"
ON project_tasks FOR UPDATE
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Update RLS policies for project_messages to handle solo projects
DROP POLICY IF EXISTS "Users can create messages in their projects" ON project_messages;
DROP POLICY IF EXISTS "Users can view messages in their projects" ON project_messages;

CREATE POLICY "Users can create messages in their projects"
ON project_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- Solo projects: user is the creator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_messages.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR
    -- Match-based projects: user is part of the match
    EXISTS (
      SELECT 1 FROM projects p
      JOIN matches m ON m.id = p.match_id
      WHERE p.id = project_messages.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can view messages in their projects"
ON project_messages FOR SELECT
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_messages.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_messages.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Update RLS policies for project_files to handle solo projects
DROP POLICY IF EXISTS "Users can upload files to their projects" ON project_files;
DROP POLICY IF EXISTS "Users can view files in their projects" ON project_files;

CREATE POLICY "Users can upload files to their projects"
ON project_files FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- Solo projects: user is the creator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_files.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR
    -- Match-based projects: user is part of the match
    EXISTS (
      SELECT 1 FROM projects p
      JOIN matches m ON m.id = p.match_id
      WHERE p.id = project_files.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can view files in their projects"
ON project_files FOR SELECT
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_files.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_files.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Update RLS policies for milestones to handle solo projects
DROP POLICY IF EXISTS "Users can create milestones in their projects" ON milestones;
DROP POLICY IF EXISTS "Users can view milestones in their projects" ON milestones;
DROP POLICY IF EXISTS "Users can update milestones in their projects" ON milestones;

CREATE POLICY "Users can create milestones in their projects"
ON milestones FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND (
    -- Solo projects: user is the creator
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = milestones.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR
    -- Match-based projects: user is part of the match
    EXISTS (
      SELECT 1 FROM projects p
      JOIN matches m ON m.id = p.match_id
      WHERE p.id = milestones.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can view milestones in their projects"
ON milestones FOR SELECT
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = milestones.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update milestones in their projects"
ON milestones FOR UPDATE
USING (
  -- Solo projects: user is the creator
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = milestones.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR
  -- Match-based projects: user is part of the match
  EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);