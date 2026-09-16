-- Add priority + simple metadata for richer task UI
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS labels text[] NOT NULL DEFAULT '{}'::text[];

-- Helpful index for board filtering
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_status
  ON public.project_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned
  ON public.project_tasks (assigned_to);

-- Attachments on chat messages (URLs to files in project storage)
ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;