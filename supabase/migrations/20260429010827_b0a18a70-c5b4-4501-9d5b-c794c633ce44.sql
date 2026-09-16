-- Add kind + submission_files to project_deliverables
ALTER TABLE public.project_deliverables
  ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS submission_files JSONB DEFAULT '[]'::jsonb;

-- Constrain kind to known presets (loose — allow 'other' as catch-all)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_deliverables_kind_check'
  ) THEN
    ALTER TABLE public.project_deliverables
      ADD CONSTRAINT project_deliverables_kind_check
      CHECK (kind IN (
        'image','video','audio','voiceover','music',
        'writing','design','social_post','model_shoot',
        'edit','document','other'
      ));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS project_deliverables_kind_idx
  ON public.project_deliverables(kind);