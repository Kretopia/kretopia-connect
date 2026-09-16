-- Create ThriveDesk tables for project collaboration

-- Projects table (one per match)
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  budget text,
  deadline timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Project messages table
CREATE TABLE public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Project tasks table
CREATE TABLE public.project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  assigned_to uuid,
  created_by uuid NOT NULL,
  due_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Project files table
CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view projects they're part of"
ON public.projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update their projects"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = projects.match_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "System can create projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their projects"
ON public.project_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_messages.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can create messages in their projects"
ON public.project_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_messages.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks in their projects"
ON public.project_tasks FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can create tasks in their projects"
ON public.project_tasks FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update tasks in their projects"
ON public.project_tasks FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_tasks.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- RLS Policies for files
CREATE POLICY "Users can view files in their projects"
ON public.project_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_files.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

CREATE POLICY "Users can upload files to their projects"
ON public.project_files FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.matches m ON m.id = p.match_id
    WHERE p.id = project_files.project_id
    AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
  )
);

-- Create storage bucket for project files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can view files in their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload files to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid() IS NOT NULL
);

-- Triggers for updated_at
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();