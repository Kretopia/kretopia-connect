CREATE TABLE public.event_guest_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.creative_jams(id) ON DELETE CASCADE,
  user_a UUID NOT NULL,
  user_b UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  shared_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_guest_matches_distinct CHECK (user_a <> user_b),
  CONSTRAINT event_guest_matches_ordered CHECK (user_a < user_b),
  CONSTRAINT event_guest_matches_unique UNIQUE (event_id, user_a, user_b)
);

CREATE INDEX idx_egm_event ON public.event_guest_matches(event_id);
CREATE INDEX idx_egm_user_a ON public.event_guest_matches(user_a);
CREATE INDEX idx_egm_user_b ON public.event_guest_matches(user_b);

ALTER TABLE public.event_guest_matches ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_event_project_member(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    LEFT JOIN public.project_collaborators pc ON pc.project_id = p.id
    WHERE p.event_id = _event_id
      AND (p.created_by = _user_id OR pc.user_id = _user_id)
  );
$$;

CREATE POLICY "Hosts can view event matches"
ON public.event_guest_matches FOR SELECT TO authenticated
USING (public.is_event_project_member(event_id, auth.uid()));

CREATE POLICY "Guests can view their own matches"
ON public.event_guest_matches FOR SELECT TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE POLICY "Hosts can manage matches"
ON public.event_guest_matches FOR ALL TO authenticated
USING (public.is_event_project_member(event_id, auth.uid()))
WITH CHECK (public.is_event_project_member(event_id, auth.uid()));

CREATE TRIGGER trg_egm_updated_at
BEFORE UPDATE ON public.event_guest_matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();