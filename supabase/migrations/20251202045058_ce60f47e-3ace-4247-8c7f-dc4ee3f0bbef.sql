-- Fix RLS policy for project_collaborators to avoid auth.users reference

ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project collaborators" ON public.project_collaborators;

CREATE POLICY "Users can view project collaborators"
ON public.project_collaborators
FOR SELECT
USING (public.user_has_project_access(project_id, auth.uid()));