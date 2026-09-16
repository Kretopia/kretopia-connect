ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS assignee_id uuid,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS milestone_id uuid;

CREATE INDEX IF NOT EXISTS idx_project_deliverables_project_status
  ON public.project_deliverables(project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_deliverables_assignee
  ON public.project_deliverables(assignee_id);