-- Create project_collaborators table for managing project team members
CREATE TABLE public.project_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- Project owners can invite collaborators
CREATE POLICY "Project owners can invite collaborators"
ON public.project_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_collaborators.project_id
    AND created_by = auth.uid()
  )
);

-- Users can view collaborators in projects they own or are part of
CREATE POLICY "Users can view project collaborators"
ON public.project_collaborators
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_collaborators.project_id
    AND created_by = auth.uid()
  )
  OR user_id = auth.uid()
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Project owners can update collaborators
CREATE POLICY "Project owners can update collaborators"
ON public.project_collaborators
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_collaborators.project_id
    AND created_by = auth.uid()
  )
);

-- Project owners can remove collaborators
CREATE POLICY "Project owners can remove collaborators"
ON public.project_collaborators
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = project_collaborators.project_id
    AND created_by = auth.uid()
  )
);

-- Update project RLS policies to include collaborators
DROP POLICY IF EXISTS "Users can view their projects" ON public.projects;
CREATE POLICY "Users can view their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  (match_id IS NULL AND auth.uid() = created_by)
  OR (match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ))
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = projects.id
    AND (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
    AND status = 'accepted'
  )
);

DROP POLICY IF EXISTS "Users can update their projects" ON public.projects;
CREATE POLICY "Users can update their projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  (match_id IS NULL AND auth.uid() = created_by)
  OR (match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  ))
  OR EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = projects.id
    AND user_id = auth.uid()
    AND status = 'accepted'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_project_collaborators_updated_at
BEFORE UPDATE ON public.project_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();