ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS moodboard jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.project_deliverables
  DROP CONSTRAINT IF EXISTS project_deliverables_status_check;

ALTER TABLE public.project_deliverables
  ADD CONSTRAINT project_deliverables_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'in_progress'::text,
    'submitted'::text,
    'in_review'::text,
    'approved'::text,
    'revision_requested'::text,
    'rejected'::text
  ]));

ALTER TABLE public.project_deliverables
  ALTER COLUMN submitted_by DROP NOT NULL;