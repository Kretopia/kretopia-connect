-- Thrive Agent context table: per-project, per-user conversation memory.
CREATE TABLE public.agent_project_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  intent TEXT,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_ctx_project_user ON public.agent_project_context(project_id, user_id, created_at DESC);

ALTER TABLE public.agent_project_context ENABLE ROW LEVEL SECURITY;

-- Users can read their own agent context for projects they have access to.
CREATE POLICY "Users read own agent context"
ON public.agent_project_context FOR SELECT
TO authenticated
USING (auth.uid() = user_id AND public.user_has_project_access(project_id, auth.uid()));

-- Users can insert their own agent messages.
CREATE POLICY "Users insert own agent context"
ON public.agent_project_context FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND public.user_has_project_access(project_id, auth.uid()));

-- Users can delete their own agent context (for clear chat).
CREATE POLICY "Users delete own agent context"
ON public.agent_project_context FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Trim function: keep last 20 messages per (project_id, user_id)
CREATE OR REPLACE FUNCTION public.trim_agent_context()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.agent_project_context
  WHERE id IN (
    SELECT id FROM public.agent_project_context
    WHERE project_id = NEW.project_id AND user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trim_agent_context_after_insert
AFTER INSERT ON public.agent_project_context
FOR EACH ROW EXECUTE FUNCTION public.trim_agent_context();