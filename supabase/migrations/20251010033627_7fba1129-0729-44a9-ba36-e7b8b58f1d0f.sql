-- Create project_notes table
CREATE TABLE IF NOT EXISTS public.project_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for project_notes
CREATE POLICY "Users can view notes in their projects"
  ON public.project_notes
  FOR SELECT
  USING (
    user_has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Users can create notes in their projects"
  ON public.project_notes
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND user_has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Users can update notes in their projects"
  ON public.project_notes
  FOR UPDATE
  USING (
    user_has_project_access(project_id, auth.uid())
  );

CREATE POLICY "Users can delete notes in their projects"
  ON public.project_notes
  FOR DELETE
  USING (
    user_has_project_access(project_id, auth.uid())
  );

-- Add updated_at trigger
CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();