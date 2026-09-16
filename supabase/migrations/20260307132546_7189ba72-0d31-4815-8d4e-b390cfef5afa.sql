
-- Project credits: verified work history tied to actual projects
CREATE TABLE public.project_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  assigned_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  credit_id UUID REFERENCES public.credits(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.project_credits ENABLE ROW LEVEL SECURITY;

-- Policies: users can see credits for projects they have access to
CREATE POLICY "Users can view project credits they're part of"
  ON public.project_credits FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR assigned_by = auth.uid()
    OR public.user_has_project_access(project_id, auth.uid())
  );

-- Project owner can insert credits
CREATE POLICY "Project owner can assign credits"
  ON public.project_credits FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid());

-- Credited user can update their own (confirm/decline)
CREATE POLICY "Users can confirm their own credits"
  ON public.project_credits FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_credits;
