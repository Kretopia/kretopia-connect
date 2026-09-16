
CREATE TABLE IF NOT EXISTS public.event_recap_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  recap_caption TEXT,
  sponsor_recap_md TEXT,
  highlight_suggestions JSONB DEFAULT '[]'::jsonb,
  thank_you_drafts JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

ALTER TABLE public.event_recap_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage their event recaps"
ON public.event_recap_drafts
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_recap_drafts.event_id AND cj.created_by = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.creative_jams cj WHERE cj.id = event_recap_drafts.event_id AND cj.created_by = auth.uid())
);

CREATE TRIGGER trg_event_recap_drafts_updated
BEFORE UPDATE ON public.event_recap_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_event_recap_drafts_event ON public.event_recap_drafts(event_id);
