-- Update project_tasks RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can view tasks in their projects"
ON public.project_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tasks.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_tasks.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can create tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can create tasks in their projects"
ON public.project_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_tasks.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.id = project_tasks.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_tasks.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
    )
  )
);

DROP POLICY IF EXISTS "Users can update tasks in their projects" ON public.project_tasks;
CREATE POLICY "Users can update tasks in their projects"
ON public.project_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_tasks.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_tasks.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- Update milestones RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view milestones in their projects" ON public.milestones;
CREATE POLICY "Users can view milestones in their projects"
ON public.milestones
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = milestones.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can create milestones in their projects" ON public.milestones;
CREATE POLICY "Users can create milestones in their projects"
ON public.milestones
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = milestones.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.id = milestones.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = milestones.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
    )
  )
);

DROP POLICY IF EXISTS "Users can update milestones in their projects" ON public.milestones;
CREATE POLICY "Users can update milestones in their projects"
ON public.milestones
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = milestones.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = milestones.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = milestones.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

-- Update project_files RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view files in their projects" ON public.project_files;
CREATE POLICY "Users can view files in their projects"
ON public.project_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_files.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_files.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_files.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can upload files to their projects" ON public.project_files;
CREATE POLICY "Users can upload files to their projects"
ON public.project_files
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_files.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.id = project_files.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_files.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
    )
  )
);

-- Update project_messages RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view messages in their projects" ON public.project_messages;
CREATE POLICY "Users can view messages in their projects"
ON public.project_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_messages.project_id
    AND p.match_id IS NULL
    AND p.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_messages.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators pc
    WHERE pc.project_id = project_messages.project_id
    AND pc.user_id = auth.uid()
    AND pc.status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can create messages in their projects" ON public.project_messages;
CREATE POLICY "Users can create messages in their projects"
ON public.project_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_messages.project_id
      AND p.match_id IS NULL
      AND p.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.id = project_messages.project_id
      AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_messages.project_id
      AND pc.user_id = auth.uid()
      AND pc.status = 'accepted'
    )
  )
);