
-- Category suggestions table
CREATE TABLE public.category_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suggested_name TEXT NOT NULL,
  location_type TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own suggestions"
  ON public.category_suggestions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own suggestions"
  ON public.category_suggestions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Location claims table
CREATE TABLE public.location_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.creative_locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  proof_url TEXT,
  proof_description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, user_id)
);

ALTER TABLE public.location_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit claims"
  ON public.location_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own claims"
  ON public.location_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Location owners can see claims on their spots"
  ON public.location_claims FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.creative_locations
      WHERE id = location_id AND user_id = auth.uid()
    )
  );
