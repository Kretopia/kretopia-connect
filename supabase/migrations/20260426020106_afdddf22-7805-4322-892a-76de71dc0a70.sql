-- Deal Memos table
CREATE TABLE public.deal_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  poster_user_id UUID NOT NULL,
  creator_user_id UUID NOT NULL,
  title TEXT NOT NULL,
  rate_amount NUMERIC,
  rate_currency TEXT DEFAULT 'USD',
  rate_unit TEXT,
  usage_type TEXT,
  usage_territory TEXT,
  usage_duration TEXT,
  usage_exclusive BOOLEAN DEFAULT false,
  deliverables TEXT,
  deadline TIMESTAMPTZ,
  notes TEXT,
  pdf_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  poster_signed_at TIMESTAMPTZ,
  creator_signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

CREATE INDEX idx_deal_memos_poster ON public.deal_memos(poster_user_id);
CREATE INDEX idx_deal_memos_creator ON public.deal_memos(creator_user_id);
CREATE INDEX idx_deal_memos_application ON public.deal_memos(application_id);

ALTER TABLE public.deal_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their deal memos"
ON public.deal_memos FOR SELECT
USING (auth.uid() = poster_user_id OR auth.uid() = creator_user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Poster can create deal memo"
ON public.deal_memos FOR INSERT
WITH CHECK (auth.uid() = poster_user_id);

CREATE POLICY "Poster can update deal memo"
ON public.deal_memos FOR UPDATE
USING (auth.uid() = poster_user_id OR auth.uid() = creator_user_id);

CREATE TRIGGER update_deal_memos_updated_at
BEFORE UPDATE ON public.deal_memos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for deal memo PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-memos', 'deal-memos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Parties can read their deal memo PDFs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deal-memos'
  AND EXISTS (
    SELECT 1 FROM public.deal_memos dm
    WHERE dm.pdf_path = storage.objects.name
      AND (auth.uid() = dm.poster_user_id OR auth.uid() = dm.creator_user_id)
  )
);

CREATE POLICY "Service role can write deal memo PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'deal-memos');
