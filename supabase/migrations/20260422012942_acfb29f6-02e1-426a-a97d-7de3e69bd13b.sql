-- Add optional pinned stage to projects for the new Project Flow timeline.
-- When NULL, the stage is derived from project data (notes, tasks, files, approvals, contracts, invoices).
-- When set, the user has manually pinned the workspace to a specific stage.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS pinned_stage text;

-- Optional: light guard. Keep flexible — UI controls valid values.
COMMENT ON COLUMN public.projects.pinned_stage IS
  'Optional manual override for Desk Project Flow stage. NULL = derived. Values: discussion|brief|tasks|work|review|agreement|payment|complete';