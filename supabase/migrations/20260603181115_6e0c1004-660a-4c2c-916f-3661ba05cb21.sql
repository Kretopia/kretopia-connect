
-- THRIVE DOCUMENTS
CREATE TABLE public.thrive_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN (
    'sponsor_deck','pitch_deck','business_plan','client_proposal',
    'treatment','rate_card','moodboard_deck','one_pager'
  )),
  title TEXT NOT NULL,
  brief TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme TEXT NOT NULL DEFAULT 'editorial' CHECK (theme IN ('editorial','bold','minimal','cinematic','playful')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','published','archived')),
  cover_image_url TEXT,
  share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  view_count INT NOT NULL DEFAULT 0,
  model_used TEXT,
  credits_spent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_thrive_documents_user ON public.thrive_documents(user_id);
CREATE INDEX idx_thrive_documents_project ON public.thrive_documents(project_id);
CREATE INDEX idx_thrive_documents_share ON public.thrive_documents(share_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.thrive_documents TO authenticated;
GRANT ALL ON public.thrive_documents TO service_role;

ALTER TABLE public.thrive_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their docs"
ON public.thrive_documents FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Project members can read docs"
ON public.thrive_documents FOR SELECT
TO authenticated
USING (
  project_id IS NOT NULL
  AND public.is_project_member(project_id, auth.uid())
);

-- VERSIONS
CREATE TABLE public.thrive_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.thrive_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_thrive_doc_versions_doc ON public.thrive_document_versions(document_id);

GRANT SELECT, INSERT ON public.thrive_document_versions TO authenticated;
GRANT ALL ON public.thrive_document_versions TO service_role;

ALTER TABLE public.thrive_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their versions"
ON public.thrive_document_versions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owners insert versions"
ON public.thrive_document_versions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER trg_thrive_documents_updated_at
BEFORE UPDATE ON public.thrive_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Public read via share_token (SECURITY DEFINER, only published)
CREATE OR REPLACE FUNCTION public.get_shared_thrive_document(_token TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  intent TEXT,
  content JSONB,
  theme TEXT,
  cover_image_url TEXT,
  user_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, title, intent, content, theme, cover_image_url, user_id, created_at
  FROM public.thrive_documents
  WHERE share_token = _token AND status = 'published'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_thrive_document(TEXT) TO anon, authenticated;

-- Increment share view counter (best-effort)
CREATE OR REPLACE FUNCTION public.increment_thrive_doc_views(_token TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.thrive_documents
  SET view_count = view_count + 1
  WHERE share_token = _token AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_thrive_doc_views(TEXT) TO anon, authenticated;
