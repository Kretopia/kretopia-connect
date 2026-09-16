-- Add DELETE policies for project-related tables to allow project owners to delete

-- project_messages DELETE policy
DROP POLICY IF EXISTS "Users can delete messages in their projects" ON public.project_messages;
CREATE POLICY "Users can delete messages in their projects"
ON public.project_messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_messages.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_messages.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_messages.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- project_tasks DELETE policy
DROP POLICY IF EXISTS "Users can delete tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can delete tasks in their projects"
ON public.project_tasks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_tasks.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- milestones DELETE policy
DROP POLICY IF EXISTS "Users can delete milestones in their projects" ON public.milestones;
CREATE POLICY "Users can delete milestones in their projects"
ON public.milestones
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = milestones.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = milestones.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- time_entries DELETE policy
DROP POLICY IF EXISTS "Users can delete time entries in their projects" ON public.time_entries;
CREATE POLICY "Users can delete time entries in their projects"
ON public.time_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = time_entries.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = time_entries.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = time_entries.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- project_files DELETE policy
DROP POLICY IF EXISTS "Users can delete files in their projects" ON public.project_files;
CREATE POLICY "Users can delete files in their projects"
ON public.project_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_files.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p
    JOIN matches m ON m.id = p.match_id
    WHERE p.id = project_files.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM project_collaborators pc
    WHERE pc.project_id = project_files.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- projects DELETE policy
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (
  created_by = auth.uid()
);