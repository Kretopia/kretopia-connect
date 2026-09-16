-- Lightweight comments on any project file (moodboard, reference, asset)
CREATE TABLE public.file_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id uuid NOT NULL REFERENCES public.project_files(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_file_comments_file ON public.file_comments(file_id, created_at DESC);
CREATE INDEX idx_file_comments_user ON public.file_comments(user_id);

ALTER TABLE public.file_comments ENABLE ROW LEVEL SECURITY;

-- Members of the project can read comments on its files
CREATE POLICY "Project members can view file comments"
ON public.file_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_files f
    WHERE f.id = file_comments.file_id
      AND public.user_has_project_access(f.project_id, auth.uid())
  )
);

-- Members can comment as themselves on files in projects they have access to
CREATE POLICY "Project members can create file comments"
ON public.file_comments
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.project_files f
    WHERE f.id = file_comments.file_id
      AND public.user_has_project_access(f.project_id, auth.uid())
  )
);

-- Users can edit only their own comments
CREATE POLICY "Users can update own file comments"
ON public.file_comments
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own file comments"
ON public.file_comments
FOR DELETE
USING (user_id = auth.uid());

-- Auto-update updated_at on edit
CREATE TRIGGER update_file_comments_updated_at
BEFORE UPDATE ON public.file_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.file_comments;