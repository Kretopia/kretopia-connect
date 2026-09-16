-- Time tracking
CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  hourly_rate numeric,
  currency text DEFAULT 'USD',
  note text,
  billed_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pte_project ON public.project_time_entries(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pte_user_running ON public.project_time_entries(user_id) WHERE ended_at IS NULL;

ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view time entries"
ON public.project_time_entries FOR SELECT
USING (public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can insert their own time entries"
ON public.project_time_entries FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.user_has_project_access(project_id, auth.uid()));

CREATE POLICY "Users can update own time entries"
ON public.project_time_entries FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own time entries"
ON public.project_time_entries FOR DELETE
USING (user_id = auth.uid());

-- Auto-fill duration on stop
CREATE OR REPLACE FUNCTION public.calc_time_entry_duration()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calc_time_entry_duration ON public.project_time_entries;
CREATE TRIGGER trg_calc_time_entry_duration
BEFORE INSERT OR UPDATE ON public.project_time_entries
FOR EACH ROW EXECUTE FUNCTION public.calc_time_entry_duration();

-- Timestamp-pinned comments on video/audio files
ALTER TABLE public.file_comments
  ADD COLUMN IF NOT EXISTS timestamp_seconds numeric;

CREATE INDEX IF NOT EXISTS idx_file_comments_timestamp
  ON public.file_comments(file_id, timestamp_seconds)
  WHERE timestamp_seconds IS NOT NULL;