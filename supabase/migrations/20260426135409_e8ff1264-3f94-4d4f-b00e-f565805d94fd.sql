-- Talent Shortlists feature
CREATE TABLE public.talent_shortlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'purple',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.talent_shortlist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shortlist_id UUID NOT NULL REFERENCES public.talent_shortlists(id) ON DELETE CASCADE,
  creator_user_id UUID NOT NULL,
  note TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (shortlist_id, creator_user_id)
);

CREATE INDEX idx_talent_shortlists_owner ON public.talent_shortlists(owner_id);
CREATE INDEX idx_talent_shortlist_items_shortlist ON public.talent_shortlist_items(shortlist_id);
CREATE INDEX idx_talent_shortlist_items_creator ON public.talent_shortlist_items(creator_user_id);

ALTER TABLE public.talent_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.talent_shortlist_items ENABLE ROW LEVEL SECURITY;

-- Shortlists: only owner can CRUD (private by design)
CREATE POLICY "Owners view their shortlists"
ON public.talent_shortlists FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners create shortlists"
ON public.talent_shortlists FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update shortlists"
ON public.talent_shortlists FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete shortlists"
ON public.talent_shortlists FOR DELETE
USING (auth.uid() = owner_id);

-- Items: only the shortlist owner can CRUD
CREATE POLICY "Owners view shortlist items"
ON public.talent_shortlist_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.talent_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners add shortlist items"
ON public.talent_shortlist_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.talent_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners update shortlist items"
ON public.talent_shortlist_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.talent_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners delete shortlist items"
ON public.talent_shortlist_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.talent_shortlists s WHERE s.id = shortlist_id AND s.owner_id = auth.uid()));

-- Reuse existing timestamp trigger
CREATE TRIGGER update_talent_shortlists_updated_at
BEFORE UPDATE ON public.talent_shortlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();